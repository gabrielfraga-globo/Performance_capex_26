import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "../App";
import { ClasseTag, ConfTag, Drawer, Inacao, StatusPill } from "./ui";
import type { Rc } from "../types";
import { brl, brlCheio, dataBR } from "../lib/format";

/** Drill-down progressivo: Projeto → Fornecedor → RC → NF. */
export default function ProjetoDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { b } = useApp();
  const x = b.projetos.find((p) => p.idPPM === id);
  const rcs = useMemo(() => b.rcs.filter((r) => r.idPPM === id), [b, id]);
  const mocks = b.mocks.filter((m) => m.idPPM === id);
  const porForn = useMemo(() => {
    const m = new Map<string, Rc[]>();
    for (const r of rcs) m.set(r.fornecedor, [...(m.get(r.fornecedor) ?? []), r]);
    return [...m.entries()].map(([f, l]) => ({ f, l, total: l.reduce((s, r) => s + (r.valida ? r.planejado : r.realizado), 0) }))
      .sort((a, c) => c.total - a.total);
  }, [rcs]);
  const [aberto, setAberto] = useState<string | null>(null);
  if (!x) return null;

  return (
    <Drawer open={!!id} onClose={onClose} width={760} title={<><span className="text-ink-faint tabular mr-1">{x.idPPM}</span>{x.projeto}</>}>
      <div className="flex flex-wrap items-center gap-2">
        <ClasseTag c={x.classe} /><ConfTag c={x.confianca} />
        {x.responsavel && <span className="text-[12px] text-ink-muted">Responsável: <b>{x.responsavel}</b></span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular">
        {[
          ["BGQ3 (teto)", x.bgq3], ["Emitido válido", x.emitido], ["A emitir", x.aEmitir], ["Pago em RC a cancelar", x.nvRealizado],
          ["Comprometido", x.comprometido], [x.classe === "saldo" ? "Saldo" : "Acima do teto", x.classe === "saldo" ? x.saldo : x.excesso],
          ["Saldo a cancelar", x.aCancelar], ["NF a re-ratear", x.reRatear],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-line bg-card-alt px-3 py-2">
            <div className="text-[11px] text-ink-faint">{l}</div>
            <div className="text-[15px] font-bold">{brl(v as number)}</div>
          </div>
        ))}
      </div>

      {x.causa && (
        <div className="mt-4 rounded-lg border border-line p-3 text-[13px] space-y-1.5">
          <div><b>Por que:</b> {x.causa}</div>
          {x.excesso > 0 && x.classe !== "C" && (
            <div className="text-ink-muted">
              Do excesso de {brl(x.excesso)}: {brl(x.explicadoForte)} possível duplicidade (indício forte) · {brl(x.explicadoValidar)} a validar · <b className="text-crit">{brl(x.estouroReal)} sem explicação</b>
            </div>
          )}
          <div><b>O que fazer:</b> {x.decisao}</div>
          {x.excesso > 0 && <Inacao>{x.classe === "C" ? "compromisso continua sem orçamento aprovado." : "emissão acima do teto do BGQ3."}</Inacao>}
        </div>
      )}

      {mocks.length > 0 && (
        <div className="mt-5">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink-muted mb-2">Mocks e possíveis duplicidades</h4>
          <table className="tbl">
            <thead><tr><th>Mock / RC</th><th>Leitura</th><th className="num">Planejado</th><th className="num">Duplicado</th><th>Confiança</th></tr></thead>
            <tbody>
              {mocks.map((m, i) => (
                <tr key={i}>
                  <td className="tabular text-[12px]">{m.mock}{m.rc ? <div className="text-ink-faint">{m.rc}</div> : null}</td>
                  <td className="text-[12px]">{m.leitura}</td>
                  <td className="num">{brl(m.planejado)}</td>
                  <td className="num font-semibold">{brl(m.valorDuplicado)}</td>
                  <td><ConfTag c={m.confianca} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 className="mt-5 mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-muted">Fornecedores → RCs → NFs</h4>
      <div className="space-y-2">
        {porForn.map(({ f, l, total }) => (
          <div key={f} className="rounded-lg border border-line">
            <button type="button" onClick={() => setAberto(aberto === f ? null : f)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
              <span className="flex items-center gap-1.5 font-semibold text-[13px]">
                {aberto === f ? <ChevronDown size={15} /> : <ChevronRight size={15} />} {f}
              </span>
              <span className="text-[12px] text-ink-muted tabular">{l.length} RC{l.length > 1 ? "s" : ""} · {brl(total)}</span>
            </button>
            {aberto === f && (
              <div className="overflow-x-auto border-t border-line">
                <table className="tbl">
                  <thead><tr><th>RC</th><th>Status</th><th className="num">Planejado</th><th className="num">Empenho</th><th className="num">NF paga</th><th className="num">NF a pagar</th><th>Leitura</th></tr></thead>
                  <tbody>
                    {l.map((r) => (
                      <tr key={r.rc + r.status}>
                        <td className="tabular text-[12px]">{r.rc}{r.oc && <div className="text-ink-faint">{r.oc}</div>}</td>
                        <td className="text-[12px]">{r.status}{r.ultimaCompetenciaNF && <div className="text-ink-faint">últ. NF {dataBR(r.ultimaCompetenciaNF)}</div>}</td>
                        <td className="num" title={brlCheio(r.planejado)}>{brl(r.planejado)}</td>
                        <td className="num" title={brlCheio(r.empenho)}>{brl(r.empenho)}</td>
                        <td className="num">{brl(r.nfRealizado)}</td>
                        <td className="num">{brl(r.nfFuturaValida ?? r.nfPlanejadaAberta)}</td>
                        <td className="text-[12px]">
                          {!r.valida && <StatusPill tone="crit">RC a cancelar</StatusPill>}
                          {r.aCancelar > 0 && <div className="text-crit">cancelar {brl(r.aCancelar)}</div>}
                          {r.reRatear > 0 && <div className="text-warn">re-ratear {brl(r.reRatear)}</div>}
                          {r.valida && r.sinal && r.sinal !== "OK" && <div className="text-ink-muted">{r.sinal}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {porForn.length === 0 && <p className="text-[13px] text-ink-faint">Projeto sem RCs de Reservas.</p>}
      </div>
    </Drawer>
  );
}
