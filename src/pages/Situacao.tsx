import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, Download, Hourglass, Lightbulb, Mail, Plus, RotateCw, Sparkles, X } from "lucide-react";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../App";
import { areas as listarAreas, comAjuste, consolidar, defesas as listarDefesas, diretorias, SEM_AREA, type Cenario, type Consolidado } from "../lib/sustentacao";
import { notificar } from "../lib/decisoes";
import { brl, mes, mi } from "../lib/format";

/**
 * Visão gerencial. Narrativa: Situação → Problema → Possível solução → Projetos impactados → Detalhamento.
 * Pergunta: "A demanda cabe no orçamento e por quantos meses conseguimos sustentar a operação?"
 * Só mostra valores somados das extrações DAX; o que não está validado aparece como "Aguardando validação".
 * Visual: padrão Monex (docs/padroes/home-gerencial-narrativa). Números brancos; cor só em badge, ponto e barra.
 */
const RUBRICAS = ["MDO", "INSTALAÇÃO", "RESERVA"] as const;
const NOME_RUB: Record<string, string> = { MDO: "MDO", "INSTALAÇÃO": "Instalação", RESERVA: "Reserva" };
const NOME_CEN: Record<Cenario, string> = { bgq1: "BGQ1", bgq2: "BGQ2", bgq3: "BGQ3" };
const NOME_VISAO = { rubrica: "Por rubrica", diretoria: "Por diretoria", area: "Por área (N4)", defesa: "Por defesa" } as const;
type Item = { id: string; nome: string; c: Consolidado };
type Visao = keyof typeof NOME_VISAO;
const curtaDir = (d: string) => d.replace(/^Plataformas De /i, "");
const MIN = new Set(["e", "de", "da", "do"]);
/** "PLAT. DE PÓS-PROD. E DESIGN" → "Pós-prod. e Design" */
const curtaArea = (a: string) => a === SEM_AREA ? a : a.replace(/^PLAT(AFORMA)?\.?\s+DE\s+/i, "").toLowerCase()
  .split(" ").map((w, i) => (i > 0 && MIN.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");

export default function Situacao() {
  const { b, ir } = useApp();
  const sus = b.sustentacao;
  const dirs = useMemo(() => diretorias(sus), [sus]);
  const [rub, setRub] = useState<string>("");
  const [dir, setDir] = useState<string>("");
  const [cen, setCen] = useState<Cenario>("bgq3");
  const [area, setArea] = useState<string>("");
  const [visao, setVisao] = useState<Visao>("rubrica");
  const [simAberto, setSimAberto] = useState(false);
  const lstAreas = useMemo(() => listarAreas(sus, dir || null), [sus, dir]);
  const [def, setDef] = useState<string>("");
  const lstDefesas = useMemo(() => listarDefesas(sus), [sus]);

  const k = useMemo(() => consolidar(sus, cen, rub || null, dir || null, area || null, def || null), [sus, cen, rub, dir, area, def]);
  const itens: Item[] = useMemo(() => {
    const ar = area || null, di = dir || null, ru = rub || null, de = def || null;
    if (visao === "diretoria") return (dir ? [dir] : dirs).map((d) => ({ id: d, nome: curtaDir(d), c: consolidar(sus, cen, ru, d, ar, de) }));
    if (visao === "area") return (area ? [area] : lstAreas).map((a) => ({ id: a, nome: curtaArea(a), c: consolidar(sus, cen, ru, di, a, de) }));
    if (visao === "defesa") return (def ? [def] : lstDefesas).map((d) => ({ id: d, nome: d, c: consolidar(sus, cen, ru, di, ar, d) }));
    return (rub ? [rub] : [...RUBRICAS]).map((r) => ({ id: r, nome: NOME_RUB[r], c: consolidar(sus, cen, r, di, ar, de) }));
  }, [sus, cen, rub, dir, area, def, visao, dirs, lstAreas, lstDefesas]);
  const sobras = itens.filter((x) => x.c.resultado > 0.5).sort((a, c) => c.c.resultado - a.c.resultado);
  const faltas = itens.filter((x) => x.c.resultado < -0.5).sort((a, c) => a.c.resultado - c.c.resultado);
  const escopo = [area ? curtaArea(area) : dir ? curtaDir(dir) : "Reservas", rub ? NOME_RUB[rub] : "", def].filter(Boolean).join(" · ");

  return (
    <div className="space-y-16">
      <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="max-w-[820px]">
          <p className="t-label">Ciclo {mes(sus.ciclo.de)} → {mes(sus.ciclo.ate)}</p>
          <h1 className="t-hero mt-4">A demanda cabe no orçamento e por quantos meses sustentamos a operação?</h1>
        </div>
        <Filtros rub={rub} setRub={setRub} dir={dir} setDir={(v) => { setDir(v); setArea(""); }} dirs={dirs} area={area} setArea={setArea} areas={lstAreas} def={def} setDef={setDef} defs={lstDefesas} cen={cen} setCen={setCen} />
      </header>

      {/* Situação + como chegamos */}
      <section>
        <Situacao1 k={k} cen={NOME_CEN[cen]} escopo={escopo} faltas={visao === "area" ? [] : faltas.filter((x) => x.id !== rub && x.id !== dir && x.id !== area)} />
        <div className="mt-12 grid gap-12 border-t border-line pt-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Grafico k={k} cen={NOME_CEN[cen]} />
          <Fluxo k={k} cen={NOME_CEN[cen]} mesCorrente={sus.mesCorrente} ate={sus.ciclo.ate} />
        </div>
        {k.pagoExcluido > 0.5 && (
          <p className="t-aux mt-8">{brl(k.pagoExcluido)} já pagos ficam fora da demanda futura (NF no realizado · conferência V03).</p>
        )}
      </section>

      {/* Onde sobra / Onde falta — cada card gira para mostrar a possível solução */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="t-section">Onde está o problema</h2>
          <div className="flex rounded-xl border border-line p-1 text-[12px] font-light" role="tablist" aria-label="Agrupar por">
            {(Object.keys(NOME_VISAO) as Visao[]).filter((v) => v !== "defesa" || lstDefesas.length > 0).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={visao === v} onClick={() => setVisao(v)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 ${visao === v ? "bg-card-alt text-ink" : "text-ink-faint hover:text-ink-muted"}`}>
                {NOME_VISAO[v]}
              </button>
            ))}
          </div>
        </div>
        {(
          <div className="grid gap-6 lg:grid-cols-2">
            <Flip
              frente={<ListaFace titulo="Onde sobra" tom="ok" itens={sobras} vazio="Nada sobra neste recorte. Limpe os filtros para ver onde sobra." />}
              verso={<SobraVerso sobras={sobras} />}
              rotulos={["Uso da sobra", "Voltar"]} />
            <Flip
              frente={<ListaFace titulo="Onde falta" tom="crit" itens={faltas} vazio="Nada falta neste recorte." />}
              verso={<SolucaoVerso k={k} sobras={sobras} faltas={faltas} ir={ir} onSimular={() => setSimAberto(true)} />}
              rotulos={["Possível solução", "Voltar"]} destaque={faltas.length > 0} />
          </div>
        )}
        {simAberto && (
          <Simulador key={`${visao}|${rub}|${dir}|${area}|${def}|${cen}`} itens={itens} visao={NOME_VISAO[visao]} cen={NOME_CEN[cen]} onFechar={() => setSimAberto(false)} />
        )}
      </section>

      {/* Mês a mês */}
      <section className="space-y-6">
        <h2 className="t-section">Mês a mês</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Linhas k={k} cen={NOME_CEN[cen]} modo="mensal" />
          <Linhas k={k} cen={NOME_CEN[cen]} modo="acumulado" />
        </div>
      </section>
    </div>
  );
}

const nomes = (xs: Item[]) => (xs.length > 2 ? `${xs.slice(0, 2).map((x) => x.nome).join(", ")} e mais ${xs.length - 2}` : xs.map((x) => x.nome).join(" e "));
const addUm = (ym: number) => (ym % 100 === 12 ? (Math.floor(ym / 100) + 1) * 100 + 1 : ym + 1);
const abs = (v: number) => brl(Math.abs(v));

/* ---------- Filtros discretos ---------- */
function Ghost({ valor, onChange, rotulo, children }: { valor: string; onChange: (v: string) => void; rotulo: string; children: React.ReactNode }) {
  return (
    <label className="relative flex items-center text-ink-muted hover:text-ink">
      <select className="cursor-pointer appearance-none bg-transparent pr-5" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo}>{children}</select>
      <ChevronDown size={13} className="pointer-events-none absolute right-0" aria-hidden />
    </label>
  );
}
function Filtros({ rub, setRub, dir, setDir, dirs, area, setArea, areas, def, setDef, defs, cen, setCen }: {
  rub: string; setRub: (v: string) => void; dir: string; setDir: (v: string) => void; dirs: string[];
  area: string; setArea: (v: string) => void; areas: string[]; def: string; setDef: (v: string) => void; defs: string[];
  cen: Cenario; setCen: (v: Cenario) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-light no-print">
      <Ghost valor={dir} onChange={setDir} rotulo="Diretoria (N3)">
        <option value="">Todas as diretorias</option>
        {dirs.map((d) => <option key={d} value={d}>{curtaDir(d)}</option>)}
      </Ghost>
      <span className="text-ink-faint/50" aria-hidden>/</span>
      <Ghost valor={area} onChange={setArea} rotulo="Área (N4)">
        <option value="">Todas as áreas</option>
        {areas.map((a) => <option key={a} value={a}>{curtaArea(a)}</option>)}
      </Ghost>
      <span className="text-ink-faint/50" aria-hidden>/</span>
      {defs.length > 0 ? (
        <Ghost valor={def} onChange={setDef} rotulo="Defesa (safra do projeto)">
          <option value="">Todas as defesas</option>
          {defs.map((d) => <option key={d} value={d}>{d}</option>)}
        </Ghost>
      ) : (
        <span className="flex items-center gap-1.5 text-ink-faint" title="A consulta D02 passou a trazer dProjetos[Defesa]. Rode atualizar.cmd (ou reexporte a D02) para ligar o filtro.">
          <Hourglass size={12} aria-hidden /> Defesa
        </span>
      )}
      <span className="text-ink-faint/50" aria-hidden>/</span>
      <Ghost valor={rub} onChange={setRub} rotulo="Rubrica">
        <option value="">Todas as rubricas</option>
        {RUBRICAS.map((r) => <option key={r} value={r}>{NOME_RUB[r]}</option>)}
      </Ghost>
      <span className="text-ink-faint/50" aria-hidden>/</span>
      <div className="flex items-center gap-4" role="radiogroup" aria-label="Cenário de orçamento">
        {(["bgq1", "bgq2", "bgq3"] as Cenario[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cen === c} onClick={() => setCen(c)}
            className={cen === c ? "text-ink" : "text-ink-faint hover:text-ink-muted"}>{NOME_CEN[c]}</button>
        ))}
      </div>
      <span className="text-ink-faint/50" aria-hidden>/</span>
      <span className="flex items-center gap-1.5 text-ink-faint" title="Responsável é a hierarquia de alocação (dim_gestores); o orçamento não tem responsável. Aguardando regra.">
        <Hourglass size={12} aria-hidden /> Responsável
      </span>
    </div>
  );
}

/* ---------- 1 · Situação ---------- */
function Situacao1({ k, cen, escopo, faltas }: { k: Consolidado; cen: string; escopo: string; faltas: Item[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className={`badge ${k.coberto ? "badge-ok" : "badge-crit"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{k.coberto ? "Coberto" : "Não coberto"}
      </span>
      <p className="t-message">
        {escopo}: a demanda {k.coberto ? "cabe" : "não cabe"} no {cen}. O orçamento sustenta{" "}
        <span className={`font-medium ${k.coberto ? "text-ok" : "text-crit"}`}>{k.mesesSustentados} de {k.totalMeses} meses</span>
        {k.sustentaAte && !k.coberto ? `, até ${mes(k.sustentaAte)}` : " do ciclo"}.
      </p>
      {(faltas.length > 0 || k.alemDoCiclo.nf > 0.5) && (
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {faltas.map((x) => <Pill key={x.id} dot="bg-crit" rotulo={x.nome} valor={brl(x.c.resultado)} />)}
          {k.alemDoCiclo.nf > 0.5 && <Pill dot="bg-warn" rotulo={`NF ${k.alemDoCiclo.meses.map(mes).join(", ")} fora do ciclo`} valor={brl(k.alemDoCiclo.nf)} />}
        </div>
      )}
    </div>
  );
}
function Pill({ dot, rotulo, valor }: { dot: string; rotulo: string; valor: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px] font-light text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />{rotulo}<span className="font-normal text-ink tabular">{valor}</span>
    </span>
  );
}

/* ---------- 2 · Como chegamos ---------- */
function Fluxo({ k, cen, mesCorrente, ate }: { k: Consolidado; cen: string; mesCorrente: number; ate: number }) {
  return (
    <dl className="space-y-9 lg:border-l lg:border-line lg:pl-12">
      <Numero rotulo="Orçamento disponível" valor={brl(k.disponivel)} badge={<span className="badge badge-neutral">{cen}</span>}
        detalhe={`${mi(k.bg, 2)} − realizado ${mi(k.realizado, 2)} − em pagamento ${mi(k.emPagamento, 2)} (R$ mi)`} />
      {k.pendenciaVencida + k.pendenciaCorrente > 0.5 && (
        <Numero rotulo="Pendências (ago/26 → mês corrente)" valor={brl(k.pendenciaVencida + k.pendenciaCorrente)} badge={null}
          detalhe={`vencidas: ${brl(k.pendenciaVencida)} · mês corrente sem NF: ${brl(k.pendenciaCorrente)}`} />
      )}
      <Numero rotulo="Demanda futura" valor={brl(k.demandaFutura)} badge={null}
        detalhe={`Terceiros a pagar · caixa ${mes(addUm(mesCorrente))} → ${mes(ate)}`} />
      <Numero rotulo={k.coberto ? "Sobra no ciclo" : "Falta no ciclo"} valor={abs(k.resultado)}
        badge={<span className={`badge ${k.coberto ? "badge-ok" : "badge-crit"}`}>{k.mesesSustentados}/{k.totalMeses} meses</span>}
        detalhe={k.sustentaAte ? `Sustenta até ${mes(k.sustentaAte)}` : "Não sustenta o primeiro mês"} />
    </dl>
  );
}
function Numero({ rotulo, valor, detalhe, badge }: { rotulo: string; valor: string; detalhe: string; badge: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] font-light text-ink-muted">{rotulo}</dt>
      <dd className="mt-2 flex items-center justify-between gap-3"><span className="t-kpi">{valor}</span>{badge}</dd>
      <dd className="t-aux mt-2 tabular">{detalhe}</dd>
    </div>
  );
}

/* ---------- Gráfico de barras: consumo acumulado × teto ---------- */
const COR_TOPO: Record<string, string> = { realizado: "var(--c-ink-faint)", corrente: "var(--c-ink-muted)", demanda: "var(--c-accent)", estouro: "var(--c-crit)" };
function BarraMonex(props: { x?: number; y?: number; width?: number; height?: number; tipo?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, tipo = "realizado" } = props;
  if (height <= 0) return null;
  const r = Math.min(10, width / 2);
  const fill = tipo === "demanda" || tipo === "estouro" ? `url(#grad-${tipo})` : "url(#hachura)";
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return (
    <g>
      <path d={d} fill={fill} />
      <path d={`M${x + r * 0.6},${y + 0.75} L${x + width - r * 0.6},${y + 0.75}`} stroke={COR_TOPO[tipo]} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}
const eixoY = (topo: number) => {
  const passo = topo > 20e6 ? 10e6 : topo > 8e6 ? 4e6 : topo > 4e6 ? 2e6 : 1e6;
  return Array.from({ length: Math.ceil(topo / passo) + 1 }, (_, i) => i * passo);
};
const fmtY = (v: number) => (v === 0 ? "0" : `${mi(v, v < 1e6 ? 1 : 0)} mi`);
function Grafico({ k, cen }: { k: Consolidado; cen: string }) {
  const ticks = eixoY(Math.max(k.bg, ...k.serie.map((s) => s.acumulado)));
  const dados = k.serie.map((s) => ({ m: mes(s.mes), v: s.acumulado, consumo: s.consumo, tipo: s.coberto ? s.tipo : "estouro" }));
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-light text-ink-muted">Consumo acumulado × teto {cen}</p>
        <div className="flex flex-wrap gap-5 text-[12px] font-light text-ink-faint">
          <Leg cor="var(--c-ink-faint)">Realizado</Leg>
          <Leg cor="var(--c-accent)">Demanda futura</Leg>
          {dados.some((d) => d.tipo === "estouro") && <Leg cor="var(--c-crit)">Acima do teto</Leg>}
        </div>
      </div>
      <div className="chart-monex mt-8 h-[320px]" role="img" aria-label={`Consumo acumulado por mês: ${dados.map((d) => `${d.m} ${brl(d.v)}`).join("; ")}. Teto ${cen} ${brl(k.bg)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 28, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%">
            {defs()}
            <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--c-ink-faint)" }} dy={10} />
            <YAxis ticks={ticks} domain={[0, ticks.at(-1)!]} tickFormatter={fmtY} width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--c-ink-faint)", opacity: 0.7 }} />
            <Tooltip content={<DicaBarra />} cursor={{ fill: "var(--c-ink)", fillOpacity: 0.04, radius: 12 } as object} />
            <ReferenceLine y={k.bg} stroke="var(--c-ink-faint)" strokeOpacity={0.6} strokeDasharray="2 6"
              label={{ value: `Teto ${brl(k.bg)}`, position: "insideTopRight", fontSize: 11, fill: "var(--c-ink-muted)", dy: -18 }} />
            <Bar dataKey="v" maxBarSize={48} shape={(p: object) => <BarraMonex {...(p as object)} />}>
              {dados.map((d) => <Cell key={d.m} {...({ tipo: d.tipo } as object)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
/** Recharts só aceita <defs> como filho direto: por isso é uma função que devolve o elemento, não um componente. */
function defs() {
  return (
    <defs>
      <pattern id="hachura" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="var(--c-card-alt)" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--c-bar)" strokeWidth="1.2" strokeOpacity="0.55" />
      </pattern>
      <linearGradient id="grad-demanda" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.95} /><stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0.25} />
      </linearGradient>
      <linearGradient id="grad-estouro" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--c-crit)" stopOpacity={0.95} /><stop offset="100%" stopColor="var(--c-crit)" stopOpacity={0.25} />
      </linearGradient>
      <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}
function DicaBarra({ active, payload, label }: { active?: boolean; payload?: { payload: { v: number; consumo: number; tipo: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <CaixaDica titulo={label}>
      <LinhaDica cor={COR_TOPO[p.tipo]} rotulo="No mês" valor={brl(p.consumo)} />
      <LinhaDica rotulo="Acumulado" valor={brl(p.v)} />
    </CaixaDica>
  );
}
function CaixaDica({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-card-alt px-4 py-3 text-[12px] shadow-2xl"><p className="mb-2 font-light text-ink-faint">{titulo}</p><div className="space-y-1">{children}</div></div>;
}
function LinhaDica({ cor, rotulo, valor }: { cor?: string; rotulo: string; valor: string }) {
  return (
    <p className="flex items-center justify-between gap-8">
      <span className="flex items-center gap-2 font-light text-ink-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: cor ?? "transparent" }} />{rotulo}</span>
      <span className="tabular">{valor}</span>
    </p>
  );
}
function Leg({ cor, children, tracejado }: { cor: string; children: string; tracejado?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {tracejado ? <span className="w-3 border-t border-dashed" style={{ borderColor: cor }} aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} aria-hidden />}
      {children}
    </span>
  );
}

/* ---------- Card que gira (frente / verso) ---------- */
function Flip({ frente, verso, rotulos, destaque }: { frente: React.ReactNode; verso: React.ReactNode; rotulos: [string, string]; destaque?: boolean }) {
  const [virado, setVirado] = useState(false);
  return (
    <div className="flip-card">
      <div className={`flip-inner ${virado ? "is-flipped" : ""}`}>
        <div className="flip-face surface rounded-2xl p-9" aria-hidden={virado}>
          {frente}
          <BotaoGiro onClick={() => setVirado(true)} destaque={destaque}>{rotulos[0]}</BotaoGiro>
        </div>
        <div className="flip-face flip-back surface rounded-2xl p-9" aria-hidden={!virado}>
          {verso}
          <BotaoGiro onClick={() => setVirado(false)}>{rotulos[1]}</BotaoGiro>
        </div>
      </div>
    </div>
  );
}
function BotaoGiro({ onClick, children, destaque }: { onClick: () => void; children: string; destaque?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`absolute right-7 top-7 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-light transition hover:text-ink ${destaque ? "border-info/40 text-info" : "border-line text-ink-muted"}`}>
      <RotateCw size={12} aria-hidden /> {children}
    </button>
  );
}

/* ---------- Frente: onde sobra / onde falta ---------- */
function ListaFace({ titulo, tom, itens, vazio }: { titulo: string; tom: "ok" | "crit"; itens: Item[]; vazio: string }) {
  const total = itens.reduce((t, x) => t + Math.abs(x.c.resultado), 0);
  const cor = tom === "ok" ? "var(--c-ok)" : "var(--c-crit)";
  const op = [1, 0.55, 0.3];
  return (
    <>
      <h3 className="t-section">{titulo}</h3>
      {itens.length === 0 ? <p className="t-aux mt-10">{vazio}</p> : (
        <>
          <div className="mt-10 flex items-center gap-3">
            <span className="t-num">{brl(total)}</span>
            <span className={`badge ${tom === "ok" ? "badge-ok" : "badge-crit"}`}>{tom === "ok" ? "sobra" : "falta"}</span>
          </div>
          <div className="mt-6 flex h-2 gap-1 overflow-hidden rounded-full" role="img" aria-label={itens.map((x) => `${x.nome} ${abs(x.c.resultado)}`).join("; ")}>
            {itens.map((x, i) => <div key={x.id} className="rounded-full" style={{ width: `${(Math.abs(x.c.resultado) / total) * 100}%`, background: cor, opacity: op[i % 3] }} />)}
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8">
            {itens.map((x, i) => (
              <li key={x.id}>
                <p className="flex items-center gap-2 t-item"><span className="h-2 w-2 rounded-full" style={{ background: cor, opacity: op[i % 3] }} aria-hidden />{x.nome}</p>
                <p className="t-mid mt-2">{abs(x.c.resultado)}</p>
                <p className="t-aux mt-1.5 tabular">
                  {x.id === SEM_AREA ? "Demanda sem NF: definir projeto e RC" : x.c.coberto ? `${x.c.totalMeses}/${x.c.totalMeses} meses` : `${x.c.mesesSustentados}/${x.c.totalMeses} meses · até ${x.c.sustentaAte ? mes(x.c.sustentaAte) : "—"}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ---------- Verso: uso da sobra / possível solução ---------- */
function SobraVerso({ sobras }: { sobras: Item[] }) {
  const comprometidas = sobras.filter((x) => x.c.alemDoCiclo.nf > 0.5);
  return (
    <>
      <h3 className="t-section">Uso da sobra</h3>
      <div className="mt-10 space-y-8">
        {sobras.length === 0 && <p className="t-aux">Nada sobra neste recorte. Se houver filtro de diretoria, área ou rubrica, limpe-o para ver onde sobra.</p>}
        {sobras.map((x) => (
          <div key={x.id} className="grid grid-cols-2 gap-8">
            <Ideia dot="bg-ok" titulo={`Sobra de ${x.nome}`} valor={brl(x.c.resultado)} />
            {x.c.alemDoCiclo.nf > 0.5
              ? <Ideia dot="bg-warn" titulo={`NF após ${mes(x.c.serie.at(-1)!.mes)} (fora do ciclo)`} valor={brl(x.c.alemDoCiclo.nf)} />
              : <Ideia dot="bg-ink-faint" titulo="NF após o ciclo" valor="—" />}
          </div>
        ))}
      </div>
      {sobras.length > 0 && (
        <Aviso>
          {comprometidas.length > 0 ? <>Parte da sobra já tem <span className="text-ink">NF planejada para depois do ciclo</span>, sem orçamento vigente. </> : null}
          Mover a sobra para outra rubrica, diretoria ou área ainda não tem regra nem aprovador definidos (OQ-R1).
        </Aviso>
      )}
    </>
  );
}
function SolucaoVerso({ k, sobras, faltas: todas, ir, onSimular }: { k: Consolidado; sobras: Item[]; faltas: Item[]; ir: (a: "projetos" | "operacional", f?: { fila?: string }) => void; onSimular: () => void }) {
  const semArea = todas.find((x) => x.id === SEM_AREA);
  const faltas = todas.filter((x) => x.id !== SEM_AREA);
  const totSobra = sobras.reduce((t, x) => t + x.c.resultado, 0);
  const totFalta = -faltas.reduce((t, x) => t + x.c.resultado, 0);
  return (
    <>
      <h3 className="t-section">Possível solução</h3>
      <div className="mt-10 space-y-8">
        {sobras.length > 0 && faltas.length > 0 && (
          <div>
            <Ideia dot="bg-info" titulo={`Remanejar de ${nomes(sobras)} para ${nomes(faltas)}?`} valor={`${brl(totSobra)} → ${brl(totFalta)}`} />
            <button type="button" onClick={onSimular} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-info/40 px-3.5 py-2 text-[12.5px] font-normal text-info hover:bg-info-soft">
              <Sparkles size={13} aria-hidden /> Simular plano de remanejamento
            </button>
          </div>
        )}
        {semArea && <Ideia dot="bg-warn" titulo="Definir projeto e RC da demanda sem NF" valor={brl(-semArea.c.resultado)} />}
        {faltas.length > 0 && sobras.length === 0 && <Ideia dot="bg-crit" titulo="Sem sobra neste recorte para remanejar" valor={brl(totFalta)} />}
        {!k.coberto && <Ideia dot="bg-crit" titulo="Reforço de orçamento ou redução de demanda" valor={brl(-k.resultado)} />}
        {todas.length === 0 && <p className="t-aux">Nenhuma falta neste recorte.</p>}
      </div>
      <Aviso>Remanejar <span className="text-ink">não é automático</span>: é só estudo simulado. A decisão de mover o dinheiro é do diretor.</Aviso>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-light">
        <button type="button" onClick={() => ir("projetos")} className="flex items-center gap-1 text-ink-muted hover:text-ink">Projetos impactados <ArrowUpRight size={14} aria-hidden /></button>
        <button type="button" onClick={() => ir("operacional", semArea ? { fila: "Demanda sem rateio" } : undefined)} className="flex items-center gap-1 text-ink-muted hover:text-ink">{semArea ? "Demanda sem NF" : "Detalhamento"} <ArrowUpRight size={14} aria-hidden /></button>
      </div>
    </>
  );
}
function Ideia({ dot, titulo, valor }: { dot: string; titulo: string; valor: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 t-item"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />{titulo}</p>
      <p className="t-mid mt-2">{valor}</p>
    </div>
  );
}
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-10 flex items-start gap-3 rounded-xl border border-line bg-card-alt px-4 py-3.5 text-[12.5px] font-light leading-relaxed text-ink-muted">
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden /><span>{children}</span>
    </p>
  );
}

/* ---------- Mês a mês: orçamento × realizado (linhas) ---------- */
function Linhas({ k, cen, modo }: { k: Consolidado; cen: string; modo: "mensal" | "acumulado" }) {
  const ac = modo === "acumulado";
  const dados = k.serie.map((s) => {
    const v = ac ? s.acumulado : s.consumo;
    return {
      m: mes(s.mes), orc: ac ? s.orcamentoAcum : s.orcamento,
      real: s.tipo !== "demanda" ? v : null,
      dem: s.tipo !== "realizado" ? v : null, // começa no mês corrente para emendar as linhas
      tipo: s.tipo,
      pag: s.tipo === "corrente" ? k.emPagamento : 0, // NF do mês corrente (OQ-H1), separada do realizado no tooltip
      pend: s.tipo === "corrente" ? k.pendenciaVencida + k.pendenciaCorrente : 0,
    };
  });
  const ticks = eixoY(Math.max(...dados.map((d) => Math.max(d.orc, d.real ?? 0, d.dem ?? 0))));
  return (
    <div className="surface rounded-2xl p-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="t-section">{ac ? "Acumulado no ciclo" : "Por mês de caixa"}</h3>
          <p className="t-aux mt-1">{cen} × realizado{ac ? ", somados mês a mês" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] font-light text-ink-faint">
          <Leg cor="var(--c-ink-muted)">{cen}</Leg>
          <Leg cor="var(--c-accent)">Realizado</Leg>
          <Leg cor="var(--c-accent)" tracejado>Demanda futura</Leg>
        </div>
      </div>
      <div className="mt-8 h-[240px]" role="img" aria-label={`${ac ? "Acumulado" : "Mensal"}: ${dados.map((d) => `${d.m} orçamento ${brl(d.orc)}, consumo ${brl(d.real ?? d.dem ?? 0)}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            {defs()}
            <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--c-ink-faint)" }} dy={10} interval="preserveStartEnd" />
            <YAxis ticks={ticks} domain={[0, ticks.at(-1)!]} tickFormatter={fmtY} width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--c-ink-faint)", opacity: 0.7 }} />
            <Tooltip content={<DicaLinhas cen={cen} />} cursor={{ stroke: "var(--c-line)", strokeWidth: 1 }} />
            <Area type="monotone" dataKey="real" stroke="none" fill="url(#grad-area)" connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="orc" stroke="var(--c-ink-faint)" strokeWidth={1} dot={false} activeDot={false} />
            <Line type="monotone" dataKey="real" stroke="var(--c-accent)" strokeWidth={1.25} dot={false} activeDot={false} connectNulls={false} />
            <Line type="monotone" dataKey="dem" stroke="var(--c-accent)" strokeOpacity={0.55} strokeWidth={1.25} strokeDasharray="3 5" dot={false} activeDot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function DicaLinhas({ active, payload, label, cen }: { active?: boolean; payload?: { payload: { orc: number; real: number | null; dem: number | null; tipo: string; pag: number; pend: number } }[]; label?: string; cen: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <CaixaDica titulo={label}>
      <LinhaDica cor="var(--c-ink-muted)" rotulo={cen} valor={brl(p.orc)} />
      {p.tipo === "demanda" && <LinhaDica cor="var(--c-accent)" rotulo="Demanda futura" valor={brl(p.dem ?? 0)} />}
      {p.tipo === "realizado" && <LinhaDica cor="var(--c-accent)" rotulo="Realizado (Conecta)" valor={brl(p.real ?? 0)} />}
      {p.tipo === "corrente" && (
        <>
          <LinhaDica cor="var(--c-accent)" rotulo="Realizado (Conecta)" valor={brl((p.real ?? 0) - p.pag - p.pend)} />
          <LinhaDica rotulo="Em pagamento (NF do mês)" valor={brl(p.pag)} />
          {p.pend > 0.5 && <LinhaDica rotulo="Pendências (ago/26 → mês corrente)" valor={brl(p.pend)} />}
          <LinhaDica rotulo="Total comprometido" valor={brl(p.real ?? 0)} />
        </>
      )}
    </CaixaDica>
  );
}


/* ---------- Simulador de remanejamento (estudo; aprovação do diretor) ---------- */
type Mov = { de: string; para: string; valor: number };
function sugerir(itens: Item[]): Mov[] {
  const doadores = itens.filter((x) => x.c.resultado > 0.5 && x.id !== SEM_AREA).map((x) => ({ id: x.id, livre: x.c.resultado })).sort((a, b) => b.livre - a.livre);
  const out: Mov[] = [];
  for (const f of itens.filter((x) => x.c.resultado < -0.5 && x.id !== SEM_AREA).sort((a, b) => a.c.resultado - b.c.resultado)) {
    let falta = -f.c.resultado;
    for (const d of doadores) {
      if (falta <= 0.5 || d.livre <= 0.5) continue;
      const v = Math.min(Math.ceil(Math.min(falta, d.livre) / 1000) * 1000, Math.floor(d.livre)); // arredonda para cima, sem passar da sobra
      if (v <= 0) continue;
      out.push({ de: d.id, para: f.id, valor: v });
      d.livre -= v; falta -= v;
    }
  }
  return out;
}
function Simulador({ itens, visao, cen, onFechar }: { itens: Item[]; visao: string; cen: string; onFechar: () => void }) {
  const [movs, setMovs] = useState<Mov[]>(() => sugerir(itens));
  const porId = new Map(itens.map((x) => [x.id, x]));
  const origens = itens.filter((x) => x.c.resultado > 0.5 && x.id !== SEM_AREA);
  const destinos = itens.filter((x) => x.id !== SEM_AREA);
  const delta = new Map<string, number>();
  for (const m of movs) {
    delta.set(m.de, (delta.get(m.de) ?? 0) - m.valor);
    delta.set(m.para, (delta.get(m.para) ?? 0) + m.valor);
  }
  const afetados = itens.filter((x) => delta.has(x.id));
  const total = movs.reduce((t, m) => t + m.valor, 0);
  const semArea = itens.find((x) => x.id === SEM_AREA && x.c.resultado < -0.5);
  const setMov = (i: number, m: Partial<Mov>) => setMovs((xs) => xs.map((x, j) => (j === i ? { ...x, ...m } : x)));
  const linhaTexto = (m: Mov) => `${porId.get(m.de)?.nome} → ${porId.get(m.para)?.nome}: ${brl(m.valor)}`;
  const exportar = () => {
    const csv = "\ufeff" + ["Origem;Destino;Valor;Cenário;Visão"].concat(movs.map((m) => `${porId.get(m.de)?.nome};${porId.get(m.para)?.nome};${m.valor.toFixed(2).replace(".", ",")};${cen};${visao}`)).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "plano_remanejamento_simulado.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  const sel = "min-w-0 flex-1 cursor-pointer appearance-none rounded-lg border border-line bg-card-alt px-3 py-2 text-[13px] font-light text-ink";
  return (
    <div className="surface rounded-2xl p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="t-section">Plano de remanejamento</h3>
            <span className="badge badge-warn">Simulação</span>
          </div>
          <p className="t-aux mt-2">{visao} · {cen}. Não altera o orçamento. Aprovação: diretor.</p>
        </div>
        <button type="button" onClick={onFechar} className="rounded-lg border border-line p-2 text-ink-faint hover:text-ink" aria-label="Fechar simulação"><X size={15} /></button>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Movimentos */}
        <div>
          <p className="t-label">Movimentos</p>
          <ul className="mt-5 space-y-4">
            {movs.map((m, i) => {
              const o = porId.get(m.de);
              const max = Math.max(o?.c.resultado ?? 0, m.valor);
              return (
                <li key={i} className="rounded-xl border border-line p-4">
                  <div className="flex items-center gap-2">
                    <select className={sel} value={m.de} onChange={(e) => setMov(i, { de: e.target.value })} aria-label="Origem">
                      {origens.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                    <ArrowRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
                    <select className={sel} value={m.para} onChange={(e) => setMov(i, { para: e.target.value })} aria-label="Destino">
                      {destinos.filter((x) => x.id !== m.de).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                    <button type="button" onClick={() => setMovs((xs) => xs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-ink-faint hover:text-ink" aria-label="Remover movimento"><X size={14} /></button>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <input type="range" min={0} max={Math.max(1000, Math.round(max))} step={1000} value={m.valor} onChange={(e) => setMov(i, { valor: Number(e.target.value) })} className="flex-1" aria-label="Valor" />
                    <span className="t-mid w-36 text-right text-[20px]">{brl(m.valor)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-[12.5px] font-light">
            {origens.length > 0 && destinos.length > 1 && (
              <button type="button" onClick={() => setMovs((xs) => [...xs, { de: origens[0].id, para: (destinos.find((x) => x.id !== origens[0].id) ?? destinos[0]).id, valor: 0 }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-ink-muted hover:text-ink"><Plus size={13} /> Adicionar movimento</button>
            )}
            <button type="button" onClick={() => setMovs(sugerir(itens))} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-ink-muted hover:text-ink"><Sparkles size={13} /> Sugerir plano</button>
          </div>
        </div>

        {/* Efeito */}
        <div>
          <p className="t-label">Efeito simulado</p>
          {afetados.length === 0 ? <p className="t-aux mt-5">Adicione um movimento para ver o efeito.</p> : (
            <ul className="mt-5 divide-y divide-line">
              {afetados.map((x) => {
                const d = delta.get(x.id) ?? 0;
                const depois = comAjuste(x.c, d);
                const livre = x.c.resultado - x.c.alemDoCiclo.nf;
                const alerta = d < 0 && -d > x.c.resultado + 0.5 ? "cede mais do que sobra" : d < 0 && x.c.alemDoCiclo.nf > 0.5 && -d > livre + 0.5 ? `usa a sobra comprometida com NF após o ciclo (${brl(x.c.alemDoCiclo.nf)})` : "";
                return (
                  <li key={x.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="t-item">{x.nome}</span>
                      <span className={`badge ${d > 0 ? "badge-ok" : "badge-neutral"}`}>{d > 0 ? "recebe" : "cede"} {brl(Math.abs(d))}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 tabular">
                      <span className="text-[14px] font-light text-ink-faint">{brl(x.c.resultado)}</span>
                      <ArrowRight size={13} className="text-ink-faint" aria-hidden />
                      <span className="t-mid text-[22px]">{brl(depois.resultado)}</span>
                      <span className={`badge ${depois.coberto ? "badge-ok" : "badge-crit"}`}>{depois.mesesSustentados}/{x.c.totalMeses} meses</span>
                    </div>
                    {alerta && <p className="mt-2 text-[12px] font-light text-warn">Atenção: {alerta}.</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-6">
            <div><p className="t-aux">Total remanejado</p><p className="t-mid mt-1">{brl(total)}</p></div>
            <div><p className="t-aux">Resultado da operação</p><p className="t-mid mt-1">{brl(itens.reduce((t, x) => t + x.c.resultado, 0))}</p><p className="t-aux mt-1">não muda: remanejar não cria orçamento</p></div>
          </div>
          {semArea && <p className="mt-4 text-[12px] font-light text-ink-faint">"Sem área" ({brl(semArea.c.resultado)}) não recebe remanejamento: falta definir projeto e RC dessa demanda.</p>}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6 text-[12.5px] font-light">
        <button type="button" onClick={exportar} disabled={!movs.length} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-ink-muted hover:text-ink disabled:opacity-40"><Download size={13} /> Exportar plano (CSV)</button>
        <button type="button" disabled={!movs.length}
          onClick={() => notificar(`[BG Reservas] Plano de remanejamento simulado (${cen})`, `Simulação para aprovação do diretor (${visao}, ${cen}):\n\n${movs.map(linhaTexto).join("\n")}\n\nTotal remanejado: ${brl(total)}.\nO resultado total da operação não muda.`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-info/40 px-3.5 py-2 text-info hover:bg-info-soft disabled:opacity-40"><Mail size={13} /> Enviar ao diretor para aprovação</button>
      </div>
    </div>
  );
}
