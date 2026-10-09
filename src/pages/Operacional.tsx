import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useApp } from "../App";
import { Card, ConfTag, Drawer } from "../components/ui";
import { AcoesRapidas, TagAcao } from "../components/AcoesRapidas";
import { PILARES, acaoFila, chaveFila } from "../lib/acoes";
import { exportarDecisoes, notificar } from "../lib/decisoes";
import type { ItemFila } from "../types";
import { brl } from "../lib/format";

/** Chaves usadas por outras telas → tipo de fila. */
const ALIAS: Record<string, string> = {
  cancelar: "RC a cancelar", "nao-emitir": "RC que não deve ser emitida", mocks: "Mock a baixar",
  dobro: "Possível duplicidade de planejamento", "re-ratear": "NF para re-rateio",
  "acima-empenho": "NF acima do empenho", "saldo-sem-nf": "Item aguardando validação",
};

export default function Operacional() {
  const { b, filtro, abrirProjeto, decisoes, marcar, desfazer } = useApp();
  const tipoInicial = filtro.fila ? ALIAS[filtro.fila] ?? filtro.fila : "";
  const pilarInicial = PILARES.find((p) => p.tipos.includes(tipoInicial))?.id ?? "impacto";
  const [pilar, setPilar] = useState(pilarInicial);
  const [tipo, setTipo] = useState(tipoInicial);
  const [busca, setBusca] = useState("");
  const [item, setItem] = useState<ItemFila | null>(null);

  const resumo = useMemo(() => PILARES.map((p) => {
    const l = b.filas.filter((f) => p.tipos.includes(f.tipo));
    return { ...p, n: l.length, v: l.reduce((s, f) => s + f.valor, 0) };
  }), [b]);
  const P = PILARES.find((p) => p.id === pilar)!;
  const linhas = b.filas
    .filter((f) => (tipo ? f.tipo === tipo : P.tipos.includes(f.tipo)))
    .filter((f) => !busca || `${f.idPPM} ${f.projeto} ${f.rc} ${f.fornecedor} ${f.responsavel ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, c) => c.valor - a.valor);
  const qtdDecididas = Object.keys(decisoes).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-info">3 · Execução e qualidade</p>
          <h1 className="text-[26px] font-bold leading-tight mt-1">O que o time precisa corrigir?</h1>
        </div>
        {qtdDecididas > 0 && (
          <button type="button" onClick={() => exportarDecisoes(decisoes)} className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-info" title="Registro salvo só neste navegador até existir o banco">
            <Download size={14} /> Exportar registro ({qtdDecididas})
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3" role="tablist" aria-label="Pilares">
        {resumo.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pilar === p.id}
            onClick={() => { setPilar(p.id); setTipo(""); }}
            className={`rounded-card border p-4 text-left shadow-card ${pilar === p.id ? "border-info bg-info-soft" : "border-line bg-card hover:border-info/50"}`}>
            <div className="text-[13px] font-semibold text-ink-muted">{p.nome}</div>
            <div className="mt-1 text-[26px] font-bold tabular leading-tight">{brl(p.v)}</div>
            <div className="text-[12px] text-ink-faint">{p.n} itens · {p.descricao}</div>
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de pendência" className="h-9 rounded-full border border-line bg-card px-3 text-[13px] font-semibold">
            <option value="">{P.nome}: todos</option>
            {P.tipos.map((t) => <option key={t} value={t}>{t} ({b.filas.filter((f) => f.tipo === t).length})</option>)}
          </select>
          <label className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-ink-faint" aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto, RC, fornecedor ou responsável" aria-label="Buscar"
              className="h-9 w-80 rounded-full border border-line bg-card pl-8 pr-3 text-[13px]" />
          </label>
          <span className="ml-auto text-[13px] text-ink-muted tabular">{linhas.length} itens · <b className="text-ink">{brl(linhas.reduce((s, f) => s + f.valor, 0))}</b></span>
        </div>

        <div className="overflow-x-auto max-h-[640px]">
          <table className="tbl">
            <thead><tr><th>Projeto / profissional</th><th className="num">Valor</th><th>Ação</th><th>Responsável</th><th className="num">Ação rápida</th></tr></thead>
            <tbody>
              {linhas.map((f) => {
                const a = acaoFila(f);
                const chave = chaveFila(f);
                const titulo = `${a.tag} · ${f.projeto} · ${f.rc}`;
                return (
                  <tr key={chave} className="cursor-pointer" onClick={() => setItem(f)}>
                    <td className="text-[14px] font-semibold max-w-[420px]">{f.projeto}</td>
                    <td className="num text-[15px] font-bold">{brl(f.valor)}</td>
                    <td><TagAcao {...a} /></td>
                    <td className="text-[13px] text-ink-muted">{f.responsavel ?? "—"}</td>
                    <td className="num">
                      <AcoesRapidas
                        decisao={decisoes[chave]}
                        onAprovar={() => marcar(chave, titulo, f.valor, "aprovado")}
                        onDescartar={() => marcar(chave, titulo, f.valor, "descartado")}
                        onDesfazer={() => desfazer(chave)}
                        onNotificar={() => { marcar(chave, titulo, f.valor, "notificado"); notificar(`[BG Reservas] ${titulo}`, `${f.tipo}\n${f.projeto}\n${f.rc} · ${f.fornecedor}\nValor: ${brl(f.valor)}\nAção: ${f.acao}${f.evidencia ? `\nEvidência: ${f.evidencia}` : ""}`); }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {linhas.length === 0 && <p className="py-6 text-center text-[13px] text-ink-faint">Nada pendente neste filtro.</p>}
      </Card>

      <Drawer open={!!item} onClose={() => setItem(null)} title={item ? acaoFila(item).tag : ""} width={560}>
        {item && (
          <div className="space-y-4 text-[13.5px]">
            <div className="flex items-center gap-2"><TagAcao {...acaoFila(item)} /><ConfTag c={item.confianca} /></div>
            <div className="text-[28px] font-bold tabular">{brl(item.valor)}</div>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2">
              <dt className="text-ink-faint">Tipo</dt><dd>{item.tipo}</dd>
              <dt className="text-ink-faint">Projeto / profissional</dt><dd>{item.idPPM && <span className="text-ink-faint tabular mr-1">{item.idPPM}</span>}{item.projeto}</dd>
              <dt className="text-ink-faint">RC / competência</dt><dd className="tabular">{item.rc}</dd>
              <dt className="text-ink-faint">Fornecedor</dt><dd>{item.fornecedor}</dd>
              <dt className="text-ink-faint">Status</dt><dd>{item.status}</dd>
              <dt className="text-ink-faint">Responsável</dt><dd>{item.responsavel ?? "Não informado no modelo"}</dd>
            </dl>
            <div className="rounded-lg border border-line p-3 space-y-1">
              <p><b>O que fazer:</b> {item.acao}</p>
              {item.evidencia && <p className="text-ink-muted"><b className="text-ink">Evidência:</b> {item.evidencia}</p>}
            </div>
            {item.idPPM && (
              <button type="button" onClick={() => { const id = item.idPPM; setItem(null); abrirProjeto(id); }} className="text-[13px] font-semibold text-info hover:underline">
                Abrir o projeto (fornecedores, RCs e NFs) →
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
