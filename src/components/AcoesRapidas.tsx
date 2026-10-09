import { Check, Mail, RotateCcw, X } from "lucide-react";
import type { Decisao, StatusDecisao } from "../lib/decisoes";
import type { Tom } from "../lib/acoes";

const TOM: Record<Tom, string> = {
  crit: "bg-crit-soft text-crit", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info",
  hyp: "bg-hyp-soft text-hyp", ok: "bg-ok-soft text-ok", neutral: "bg-card-alt text-ink-muted",
};

/** Tag curta de ação: uma palavra-chave, uma cor. */
export function TagAcao({ tag, tom }: { tag: string; tom: Tom }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold ${TOM[tom]}`}>{tag}</span>;
}

const ROTULO: Record<StatusDecisao, string> = { aprovado: "Aprovado", descartado: "Descartado", notificado: "Notificado" };

/** Botões de ação rápida. O clique não abre o painel da linha. */
export function AcoesRapidas({ decisao, onAprovar, onNotificar, onDescartar, onDesfazer }: {
  decisao?: Decisao; onAprovar: () => void; onNotificar: () => void; onDescartar: () => void; onDesfazer: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  if (decisao && decisao.status !== "notificado") {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className={`text-[12px] font-semibold ${decisao.status === "aprovado" ? "text-ok" : "text-ink-faint"}`}>{ROTULO[decisao.status]}</span>
        <button type="button" onClick={stop(onDesfazer)} title="Desfazer" aria-label="Desfazer" className="rounded-md p-1.5 text-ink-faint hover:bg-card-alt"><RotateCcw size={14} /></button>
      </div>
    );
  }
  const btn = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-semibold";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={stop(onAprovar)} className={`${btn} border-ok/40 text-ok hover:bg-ok-soft`} title="Aprovar a ação recomendada"><Check size={13} />Aprovar</button>
      <button type="button" onClick={stop(onNotificar)} className={`${btn} border-line text-ink-muted hover:bg-card-alt`} title="Abrir e-mail para o responsável"><Mail size={13} />{decisao?.status === "notificado" ? "Notificado" : "Notificar"}</button>
      <button type="button" onClick={stop(onDescartar)} className={`${btn} border-line text-ink-faint hover:bg-card-alt`} title="Descartar (não se aplica)" aria-label="Descartar"><X size={13} /></button>
    </div>
  );
}
