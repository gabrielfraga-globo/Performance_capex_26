import { useMemo, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { useApp } from "../App";
import { Card, StatusPill } from "../components/ui";
import type { DemArea, OrcArea } from "../types";
import { brl, mes, mi, num } from "../lib/format";

const RUBRICAS = ["MDO", "INSTALAÇÃO", "RESERVA"] as const;
const NOME_RUB: Record<string, string> = { MDO: "MDO", "INSTALAÇÃO": "Instalação", RESERVA: "Reserva" };
const SEM = "Sem rateio";
type Cenario = "bgq1" | "bgq2" | "bgq3";
const NOME_CEN: Record<Cenario, string> = { bgq1: "BGQ1", bgq2: "BGQ2", bgq3: "BGQ3" };

interface Celula { saldo: number; dem: number; delta: number; meses: number | null; bg: number; bgq1: number; bgq3: number }

const curta = (n4: string) => n4.replace(/^PLAT(AFORMA)?S?\.? DE /i, "").replace(/^PLATAFORMA DE /i, "");

export default function Situacao() {
  const { b, ir } = useApp();
  const p = b.parametros;
  const orc = b.areas.orcamento;
  const demAll = b.areas.demanda;

  const mesesDem = useMemo(() => [...new Set(demAll.map((d) => d.comp))].sort((a, c) => a - c), [demAll]);
  const [rub, setRub] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [resp, setResp] = useState<string>("");
  const [ate, setAte] = useState<number>(mesesDem.at(-1) ?? p.mesCorrenteCaixa);
  const [cen, setCen] = useState<Cenario>("bgq3");

  const areas = useMemo(() => {
    const tot = new Map<string, number>();
    for (const o of orc) tot.set(o.n4, (tot.get(o.n4) ?? 0) + o.bgq3);
    for (const d of demAll) if (!tot.has(d.n4)) tot.set(d.n4, 0);
    return [...tot.entries()].filter(([n4, v]) => n4 !== SEM && (v > 1 || demAll.some((d) => d.n4 === n4))).sort((a, c) => c[1] - a[1]).map(([n4]) => n4);
  }, [orc, demAll]);
  const responsaveis = useMemo(() => [...new Set(demAll.map((d) => d.g4))].sort(), [demAll]);
  const nMeses = mesesDem.filter((m) => m <= ate).length || 1;
  const filtroResp = !!resp;

  const dem = demAll.filter((d) => d.comp <= ate && (!resp || d.g4 === resp));

  const celula = (os: OrcArea[], ds: DemArea[]): Celula => {
    const bg = os.reduce((s, o) => s + o[cen], 0);
    const pago = os.filter((o) => o.mes <= p.mesCorrenteCaixa).reduce((s, o) => s + o.pago, 0);
    const nfMes = os.filter((o) => o.mes === p.mesCorrenteCaixa).reduce((s, o) => s + o.futuro, 0);
    const saldo = bg - pago - nfMes;
    const d = ds.reduce((s, x) => s + x.v, 0);
    return {
      saldo, dem: d, delta: saldo - d, meses: d > 0 ? saldo / (d / nMeses) : null, bg,
      bgq1: os.reduce((s, o) => s + o.bgq1, 0), bgq3: os.reduce((s, o) => s + o.bgq3, 0),
    };
  };
  const cel = (a: string | null, r: string | null) =>
    celula(orc.filter((o) => (!a || o.n4 === a) && (!r || o.rub === r)), dem.filter((d) => (!a || d.n4 === a) && (!r || d.rub === r)));

  const linhas = [...(area ? [area] : areas), SEM];
  const atual = cel(area || null, rub || null);
  const semRateio = cel(SEM, rub || null);

  // Decisões (no máximo 3), sempre propostas
  const decisoes = useMemo(() => {
    const out: { titulo: string; valor: number; detalhe: string; acao?: () => void; acaoLabel?: string }[] = [];
    if (filtroResp) return out;
    const cels = areas.map((a) => ({ a, c: cel(a, rub || null) }));
    const sobra = cels.filter((x) => x.c.delta > 1).sort((x, y) => y.c.delta - x.c.delta)[0];
    const falta = cels.filter((x) => x.c.delta < -1).sort((x, y) => x.c.delta - y.c.delta)[0];
    if (sobra && falta) {
      const v = Math.min(sobra.c.delta, -falta.c.delta);
      out.push({ titulo: `Avaliar remanejar até ${brl(v)} de ${curta(sobra.a)} para ${curta(falta.a)}`, valor: v, detalhe: "Proposta: depende de regra de remanejamento entre áreas e de ajuste no BG Vivo." });
    }
    if (semRateio.dem > 1) {
      const n = new Set(dem.filter((d) => d.n4 === SEM && (!rub || d.rub === rub)).map((d) => d.prof)).size;
      out.push({ titulo: `Definir projeto e NF para ${brl(semRateio.dem)} de demanda sem rateio`, valor: semRateio.dem, detalhe: `${n} profissionais sem área financeira: ninguém está pagando ainda.`, acao: () => ir("operacional", { fila: "Demanda sem rateio" }), acaoLabel: "Ver profissionais" });
    }
    const tot = cel(area || null, rub || null);
    if (tot.delta < -1) out.push({ titulo: `Cobrir ${brl(-tot.delta)}: reforço de orçamento ou redução de demanda`, valor: -tot.delta, detalhe: `Falta que sobra depois de qualquer remanejamento, até ${mes(ate)}.` });
    return out.slice(0, 3);
  }, [areas, rub, area, ate, cen, resp]); // eslint-disable-line react-hooks/exhaustive-deps

  const limpar = () => { setRub(""); setArea(""); setResp(""); setAte(mesesDem.at(-1) ?? p.mesCorrenteCaixa); setCen("bgq3"); };
  const ativo = rub || area || resp || cen !== "bgq3" || ate !== mesesDem.at(-1);
  const escopo = `${rub ? NOME_RUB[rub] : "Reservas"} (${area ? curta(area) : "todas as áreas"})`;
  const sel = "h-9 rounded-full border border-line bg-card px-3 text-[13px] font-semibold";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-info">Situação do orçamento</p>
          <h1 className="text-[26px] font-bold leading-tight mt-1">A demanda cabe no orçamento?</h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <select className={sel} value={rub} onChange={(e) => setRub(e.target.value)} aria-label="Rubrica">
          <option value="">Rubrica: todas</option>
          {RUBRICAS.map((r) => <option key={r} value={r}>{NOME_RUB[r]}</option>)}
        </select>
        <select className={sel} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área financeira (N4)">
          <option value="">Área (N4): todas</option>
          {areas.map((a) => <option key={a} value={a}>{curta(a)}</option>)}
        </select>
        <select className={sel} value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável (gestor N4 da alocação)">
          <option value="">Responsável: todos</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={sel} value={ate} onChange={(e) => setAte(Number(e.target.value))} aria-label="Competência até">
          {mesesDem.map((m) => <option key={m} value={m}>Competência: {mes(mesesDem[0])}–{mes(m)}</option>)}
        </select>
        <select className={sel} value={cen} onChange={(e) => setCen(e.target.value as Cenario)} aria-label="Cenário de orçamento">
          {(["bgq3", "bgq2", "bgq1"] as Cenario[]).map((c) => <option key={c} value={c}>Cenário: {NOME_CEN[c]}</option>)}
        </select>
        {ativo && <button type="button" onClick={limpar} className="rounded-full border border-info/40 bg-info-soft px-3 py-1.5 text-[12px] font-semibold text-info">Limpar filtros</button>}
      </div>

      {/* Frase + régua */}
      {filtroResp ? (
        <div className="rounded-card border border-info/30 bg-info-soft px-5 py-4">
          <p className="text-[19px] font-semibold">A equipe de {resp} tem {brl(atual.dem)} de demanda até {mes(ate)}.</p>
          <p className="text-[14px] text-ink-muted mt-1">
            O orçamento é por área financeira, não por responsável: a matriz mostra quais áreas pagam essa equipe.
            {semRateio.dem > 1 && ` ${brl(semRateio.dem)} ainda não têm área (sem rateio).`}
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-info/30 bg-info-soft px-5 py-4">
          <p className={`text-[20px] font-bold ${atual.delta < 0 ? "text-crit" : "text-ok"}`}>
            Até {mes(ate)}, {atual.delta < 0 ? `faltam ${brl(-atual.delta)}` : `sobram ${brl(atual.delta)}`} em {escopo}.
          </p>
          <p className="text-[14px] text-ink-muted mt-1">{fraseAreas(areas.map((a) => ({ a, c: cel(a, rub || null) })), semRateio.dem)}</p>
        </div>
      )}

      {!filtroResp && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch">
          <Bloco label="Saldo para a demanda" valor={brl(atual.saldo)} sub={`${NOME_CEN[cen]} − pago − NF de ${mes(p.mesCorrenteCaixa)}`} />
          <Op>−</Op>
          <Bloco label={`Demanda ${mes(mesesDem[0])}–${mes(ate)}`} valor={brl(atual.dem)} sub={`${nMeses} competências · ${brl(atual.dem / nMeses)}/mês`} />
          <Op>=</Op>
          <Bloco label="Delta (+ sobra, − falta)" valor={brl(atual.delta)} tone={atual.delta < 0 ? "crit" : "ok"} sub={area ? curta(area) : "todas as áreas"} />
          <Op>→</Op>
          <Bloco label="Cobertura da demanda" valor={atual.meses === null ? "—" : `${num(atual.meses)} meses`} sub="saldo ÷ demanda média" />
        </div>
      )}

      {/* Matriz */}
      <Card
        title={filtroResp ? `Onde a demanda de ${resp} é paga (R$ mi)` : "Delta por área e rubrica (R$ mi; + sobra, − falta)"}
        subtitle={filtroResp ? "Demanda distribuída pela área que paga a NF de cada profissional." : "Clique numa célula para filtrar; a linha \"Sem rateio\" é demanda sem NF planejada, ainda sem área."}
        action={<button type="button" onClick={() => ir("projetos", { area: area || undefined })} className="flex items-center gap-1 text-[12px] font-semibold text-info hover:underline">Ver projetos{area ? ` de ${curta(area)}` : ""} <ArrowRight size={13} /></button>}
      >
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Área financeira (N4)</th>
                {RUBRICAS.map((r) => <th key={r} className={`num ${rub && rub !== r ? "opacity-40" : ""}`}>{NOME_RUB[r]}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((a) => (
                <tr key={a} className={a === SEM ? "bg-card-alt" : ""}>
                  <td className="font-semibold whitespace-nowrap">
                    {a === SEM ? <span className="flex items-center gap-1">Sem rateio <span title="Demanda cadastrada sem NF planejada: ainda não tem área financeira nem orçamento associado."><Info size={13} className="text-ink-faint" /></span></span> : curta(a)}
                  </td>
                  {RUBRICAS.map((r) => (
                    <Cell key={r} c={cel(a, r)} resp={filtroResp} dim={!!rub && rub !== r} ativo={area === a && rub === r}
                      onClick={() => { if (a !== SEM) { setArea(a); setRub(r); } }} />
                  ))}
                  <Cell c={cel(a, null)} resp={filtroResp} total onClick={() => { if (a !== SEM) { setArea(a); setRub(""); } }} ativo={area === a && !rub} />
                </tr>
              ))}
              <tr className="border-t-2 border-line">
                <td className="font-bold">Total</td>
                {RUBRICAS.map((r) => <Cell key={r} c={cel(area || null, r)} resp={filtroResp} total dim={!!rub && rub !== r} />)}
                <Cell c={cel(area || null, null)} resp={filtroResp} total />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {!filtroResp && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="O que mudou: BGQ1 → BGQ3" subtitle={`Orçamento total de caixa · ${escopo}`}>
            <MudouBG orc={orc.filter((o) => (!area || o.n4 === area) && (!rub || o.rub === rub))} />
          </Card>
          <Card title="Decisões (no máximo três)" subtitle="Propostas para discussão; nenhuma é decisão aprovada.">
            {decisoes.length === 0 ? <p className="text-[13px] text-ink-faint">Nenhuma decisão pendente neste recorte.</p> : (
              <ol className="space-y-3">
                {decisoes.map((d, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-soft text-[12px] font-bold text-info">{i + 1}</span>
                    <div>
                      <p className="text-[14px] font-semibold leading-snug">{d.titulo}</p>
                      <p className="text-[12px] text-ink-muted">{d.detalhe}</p>
                      {d.acao && <button type="button" onClick={d.acao} className="mt-1 text-[12px] font-semibold text-info hover:underline">{d.acaoLabel} →</button>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

    </div>
  );
}

function fraseAreas(cels: { a: string; c: Celula }[], sem: number): string {
  const ord = cels.filter((x) => Math.abs(x.c.delta) > 1e4).sort((x, y) => x.c.delta - y.c.delta);
  const partes: string[] = [];
  const pior = ord[0], melhor = ord.at(-1);
  if (pior && pior.c.delta < 0) partes.push(`${curta(pior.a)} falta ${brl(-pior.c.delta)}`);
  if (melhor && melhor.c.delta > 0) partes.push(`${curta(melhor.a)} sobra ${brl(melhor.c.delta)}`);
  if (sem > 1) partes.push(`${brl(sem)} de demanda ainda sem rateio`);
  return partes.join(" · ");
}

function Bloco({ label, valor, sub, tone }: { label: string; valor: string; sub?: string; tone?: "crit" | "ok" }) {
  return (
    <div className="rounded-card border border-line bg-card shadow-card px-4 py-3">
      <div className="text-[12.5px] font-semibold text-ink-muted">{label}</div>
      <div className={`text-[26px] font-bold tabular leading-tight mt-1 ${tone === "crit" ? "text-crit" : tone === "ok" ? "text-ok" : ""}`}>{valor}</div>
      {sub && <div className="text-[11.5px] text-ink-faint">{sub}</div>}
    </div>
  );
}
function Op({ children }: { children: string }) {
  return <div className="hidden lg:flex items-center justify-center px-1 text-[22px] font-bold text-ink-faint" aria-hidden>{children}</div>;
}

function Cell({ c, resp, total, dim, ativo, onClick }: { c: Celula; resp: boolean; total?: boolean; dim?: boolean; ativo?: boolean; onClick?: () => void }) {
  const vazio = Math.abs(c.bg) < 1 && Math.abs(c.dem) < 1 && Math.abs(c.saldo) < 1;
  const bruto = resp ? c.dem : c.delta;
  const v = Math.abs(bruto) < 5e3 ? 0 : bruto;
  const cor = resp ? "text-ink" : v < -1e4 ? "text-crit" : v > 1e4 ? "text-ok" : "text-ink-muted";
  const titulo = resp ? `Demanda ${brl(c.dem)}` : `Saldo ${brl(c.saldo)} − demanda ${brl(c.dem)} = ${brl(c.delta)}`;
  return (
    <td className={`num ${dim ? "opacity-40" : ""} ${ativo ? "outline outline-2 outline-info -outline-offset-2" : ""} ${onClick ? "cursor-pointer hover:bg-card-alt" : ""}`} onClick={onClick} title={titulo}>
      {vazio ? <span className="text-ink-faint">—</span> : (
        <>
          <div className={`${total ? "font-bold" : "font-semibold"} ${cor}`}>{v > 0 && !resp ? "+" : v < 0 ? "−" : ""}{mi(Math.abs(v), 2)}</div>
          {!resp && <div className="text-[11px] text-ink-faint">{c.meses === null ? "sem demanda" : Math.abs(c.bg) < 1 ? "sem orçamento" : `${num(c.meses)} m`}</div>}
        </>
      )}
    </td>
  );
}

function MudouBG({ orc }: { orc: OrcArea[] }) {
  const ano = (a: number, k: "bgq1" | "bgq3") => orc.filter((o) => Math.floor(o.mes / 100) === a).reduce((s, o) => s + o[k], 0);
  const linhas = [2026, 2027].map((a) => ({ a, q1: ano(a, "bgq1"), q3: ano(a, "bgq3") }));
  const t1 = linhas.reduce((s, l) => s + l.q1, 0), t3 = linhas.reduce((s, l) => s + l.q3, 0);
  return (
    <table className="tbl">
      <thead><tr><th>Ano de caixa</th><th className="num">BGQ1</th><th className="num">BGQ3</th><th className="num">Variação</th></tr></thead>
      <tbody>
        {[...linhas, { a: 0, q1: t1, q3: t3 }].map((l) => {
          const d = l.q3 - l.q1;
          return (
            <tr key={l.a} className={l.a === 0 ? "font-bold" : ""}>
              <td>{l.a === 0 ? "Total" : l.a}</td>
              <td className="num">{brl(l.q1)}</td>
              <td className="num">{brl(l.q3)}</td>
              <td className={`num ${d < 0 ? "text-crit" : "text-ok"}`}>{brl(d)} {l.q1 > 0 && <span className="text-[11px] text-ink-faint">({Math.round((d / l.q1) * 100)}%)</span>}</td>
            </tr>
          );
        })}
      </tbody>
      <caption className="caption-bottom pt-2 text-left text-[11px] text-ink-faint">
        <StatusPill tone="neutral">BGQ1 de 2027 concentrado em mar/27: compare só o total do ano</StatusPill>
      </caption>
    </table>
  );
}

