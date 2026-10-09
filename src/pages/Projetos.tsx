import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "../App";
import { Barra, Card } from "../components/ui";
import { AcoesRapidas, TagAcao } from "../components/AcoesRapidas";
import { acaoProjeto } from "../lib/acoes";
import { notificar } from "../lib/decisoes";
import { exposicao } from "../lib/derive";
import { brl, pct } from "../lib/format";

const curta = (n4: string) => n4.replace(/^PLAT(AFORMA)?S?\.? DE /i, "");

export default function Projetos() {
  const { b, filtro, abrirProjeto, decisoes, marcar, desfazer } = useApp();
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<string>(filtro.area ?? "");
  const [acao, setAcao] = useState<string>("");
  const [visao, setVisao] = useState<"acima" | "saldo">(filtro.classe === "saldo" ? "saldo" : "acima");
  const [todos, setTodos] = useState(false);

  const n4Proj = useMemo(() => new Map(b.areas.projetos.map((x) => [x.idPPM, x.n4])), [b]);
  const areas = useMemo(() => [...new Set(b.areas.projetos.map((x) => x.n4))].filter((a) => a && a !== "(sem N4)").sort(), [b]);
  const base = b.projetos.filter((x) => (visao === "saldo" ? x.classe === "saldo" : ["A", "B", "C"].includes(x.classe)));
  const acoes = [...new Set(base.map((x) => acaoProjeto(x).tag))].sort();
  const lista = base
    .filter((x) => (!area || n4Proj.get(x.idPPM) === area) && (!acao || acaoProjeto(x).tag === acao)
      && (!busca || `${x.idPPM} ${x.projeto}`.toLowerCase().includes(busca.toLowerCase())))
    .sort((a, c) => (visao === "saldo" ? c.saldo - a.saldo : c.excesso - a.excesso));
  const visiveis = todos ? lista : lista.slice(0, 12);
  const valor = (x: (typeof lista)[number]) => (visao === "saldo" ? x.saldo : x.excesso);
  const max = Math.max(...lista.map(valor), 1);
  const total = lista.reduce((s, x) => s + valor(x), 0);
  const e = exposicao(b.projetos);
  const ativo = !!(busca || area || acao);

  const seg = [
    { label: "Possível duplicidade", v: e.duplicidadeForte, cor: "bg-info" },
    { label: "Mock a validar", v: e.aValidar, cor: "bg-warn" },
    { label: "Estouro real", v: e.estouroRealA + e.emitidoAcimaB, cor: "bg-crit" },
    { label: "Sem BGQ3", v: e.semBGQ3, cor: "bg-hyp" },
  ];
  const sel = "h-10 rounded-full bg-card-alt px-4 text-[13px] font-semibold";

  return (
    <div className="space-y-8">
      <div>
        <p className="t-label text-info">Projetos e emissão</p>
        <h1 className="t-page mt-2">Onde o plano não cabe no BGQ3?</h1>
      </div>

      <Card title={`${brl(e.bruta)} acima do teto em ${e.projetos} projetos`}>
        <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={seg.map((s) => `${s.label}: ${brl(s.v)}`).join("; ")}>
          {seg.filter((s) => s.v > 0).map((s) => <div key={s.label} className={s.cor} style={{ width: `${(s.v / e.bruta) * 100}%` }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
          {seg.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${s.cor}`} aria-hidden />
              <span className="text-[13px] text-ink-muted">{s.label}</span>
              <span className="text-[15px] font-bold tabular">{brl(s.v)}</span>
              <span className="text-[12px] text-ink-faint tabular">{pct(s.v / e.bruta)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
          <div className="flex rounded-full bg-card-alt p-1 text-[13px] font-semibold">
            {(["acima", "saldo"] as const).map((v) => (
              <button key={v} type="button" onClick={() => { setVisao(v); setAcao(""); }}
                className={`rounded-full px-3 py-1.5 ${visao === v ? "bg-card text-ink shadow-sm" : "text-ink-faint"}`}>
                {v === "acima" ? "Acima do teto" : "Com saldo"}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search size={14} className="absolute left-3 top-3 text-ink-faint" aria-hidden />
            <input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar projeto" aria-label="Buscar projeto"
              className="h-10 w-56 rounded-full bg-card-alt pl-8 pr-3 text-[13px]" />
          </label>
          <select className={sel} value={area} onChange={(ev) => setArea(ev.target.value)} aria-label="Área financeira (N4)">
            <option value="">Área: todas</option>
            {areas.map((a) => <option key={a} value={a}>{curta(a)}</option>)}
          </select>
          <select className={sel} value={acao} onChange={(ev) => setAcao(ev.target.value)} aria-label="Ação">
            <option value="">Ação: todas</option>
            {acoes.map((a) => <option key={a}>{a}</option>)}
          </select>
          {ativo && <button type="button" onClick={() => { setBusca(""); setArea(""); setAcao(""); }} className="text-[12px] font-semibold text-info">Limpar</button>}
          <span className="ml-auto text-[13px] text-ink-muted tabular">{lista.length} projetos · <b className="text-ink">{brl(total)}</b></span>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Área</th>
              <th className="num">{visao === "saldo" ? "Saldo" : "Acima do teto"}</th>
              <th>Ação</th>
              <th className="num">Ação rápida</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((x) => {
              const a = acaoProjeto(x);
              const chave = `projeto|${x.idPPM}`;
              const titulo = `${x.idPPM} ${x.projeto}: ${a.tag}`;
              return (
                <tr key={x.idPPM} className="cursor-pointer" onClick={() => abrirProjeto(x.idPPM)}>
                  <td className="text-[14px] font-semibold">{x.projeto}</td>
                  <td className="text-[13px] text-ink-muted whitespace-nowrap">{curta(n4Proj.get(x.idPPM) ?? "—")}</td>
                  <td className="num w-48">
                    <div className="text-[15px] font-bold">{brl(valor(x))}</div>
                    <Barra valor={valor(x)} max={max} tone={a.tom === "crit" ? "crit" : a.tom === "ok" ? "ok" : "warn"} />
                  </td>
                  <td><TagAcao {...a} /></td>
                  <td className="num">
                    <AcoesRapidas
                      decisao={decisoes[chave]}
                      onAprovar={() => marcar(chave, titulo, valor(x), "aprovado")}
                      onDescartar={() => marcar(chave, titulo, valor(x), "descartado")}
                      onDesfazer={() => desfazer(chave)}
                      onNotificar={() => { marcar(chave, titulo, valor(x), "notificado"); notificar(`[BG Reservas] ${a.tag} · ${x.projeto}`, `${titulo}\nValor: ${brl(valor(x))}\n${x.causa}\nDecisão recomendada: ${x.decisao}`); }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="py-6 text-center text-[13px] text-ink-faint">Nenhum projeto com estes filtros.</p>}
        {lista.length > 12 && (
          <button type="button" onClick={() => setTodos(!todos)} className="mt-3 self-start text-[12px] font-semibold text-info hover:underline">
            {todos ? "Mostrar só os 12 maiores" : `Mostrar todos (${lista.length})`}
          </button>
        )}
      </Card>
    </div>
  );
}
