import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, FlaskConical, Info, OctagonAlert, Search, X } from "lucide-react";
import type { Classe, Confianca } from "../types";

export function Card({ title, subtitle, action, children, className = "", tone }: {
  title?: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
  tone?: "crit" | "warn" | "info";
}) {
  const border = tone === "crit" ? "border-crit/40" : tone === "warn" ? "border-warn/40" : "border-line";
  return (
    <section className={`rounded-card border ${border} bg-card shadow-card p-5 flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">{title}</h3>}
            {subtitle && <p className="text-[12px] text-ink-faint mt-1">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  );
}

export function LinkBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[12px] font-semibold text-info hover:underline whitespace-nowrap">
      {children}
    </button>
  );
}

type Tone = "neutral" | "info" | "warn" | "crit" | "ok";
const toneText: Record<Tone, string> = { neutral: "text-ink", info: "text-info", warn: "text-warn", crit: "text-crit", ok: "text-ok" };

export function Kpi({ label, value, meta, status, statusTone = "neutral", micro, periodo, icon, onClick, tooltip }: {
  label: string; value: string; meta?: ReactNode; status?: string; statusTone?: Tone; micro?: ReactNode; periodo?: string;
  icon?: ReactNode; onClick?: () => void; tooltip?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={tooltip}
      className={`text-left rounded-card border border-line bg-card shadow-card px-4 py-4 flex flex-col gap-1.5 min-w-0 ${onClick ? "hover:border-info/60 cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2 text-ink-muted">
        {icon && <span className={`shrink-0 ${toneText[statusTone]}`}>{icon}</span>}
        <span className="text-[13px] font-semibold leading-snug">{label}</span>
      </div>
      <div className={`text-[28px] font-bold leading-tight tabular mt-1 ${statusTone === "neutral" ? "text-ink" : toneText[statusTone]}`}>{value}</div>
      {meta && <div className="text-[12px] text-ink-muted tabular">{meta}</div>}
      {status && <StatusPill tone={statusTone}>{status}</StatusPill>}
      {micro && <p className="text-[12px] text-ink-faint leading-snug">{micro}</p>}
      {periodo && <p className="text-[11px] text-ink-faint mt-auto pt-1">{periodo}</p>}
    </Tag>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    neutral: "bg-card-alt text-ink-muted border-line",
    info: "bg-info-soft text-info border-info/30",
    warn: "bg-warn-soft text-warn border-warn/30",
    crit: "bg-crit-soft text-crit border-crit/30",
    ok: "bg-ok-soft text-ok border-ok/30",
  };
  const Icon = tone === "crit" ? OctagonAlert : tone === "warn" ? AlertTriangle : tone === "ok" ? CheckCircle2 : Info;
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      <Icon size={12} aria-hidden /> {children}
    </span>
  );
}

const confMap: Record<Confianca, { cls: string; Icon: typeof Info; dica: string }> = {
  "Confirmado": { cls: "bg-ok-soft text-ok border-ok/30", Icon: CheckCircle2, dica: "Fato calculado a partir do modelo com regra confirmada pelo time." },
  "Indício forte": { cls: "bg-info-soft text-info border-info/30", Icon: Search, dica: "Padrão nos dados aponta a causa; falta a confirmação de quem opera." },
  "Requer validação": { cls: "bg-warn-soft text-warn border-warn/30", Icon: CircleHelp, dica: "Hipótese ou regra ainda não confirmada. Não tratar como conclusão." },
  "Dado inconsistente": { cls: "bg-crit-soft text-crit border-crit/30", Icon: AlertTriangle, dica: "Cadastro ou valor a corrigir na origem." },
  "Simulação": { cls: "bg-hyp-soft text-hyp border-hyp/30", Icon: FlaskConical, dica: "Resultado de premissas; não é previsão nem decisão aprovada." },
  "Decisão pendente": { cls: "bg-warn-soft text-warn border-warn/30", Icon: CircleHelp, dica: "Depende de decisão da diretoria." },
};

export function ConfTag({ c }: { c: Confianca | null | undefined }) {
  if (!c) return null;
  const { cls, Icon, dica } = confMap[c];
  return (
    <span title={dica} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      <Icon size={12} aria-hidden /> {c}
    </span>
  );
}

export const classeInfo: Record<Classe, { label: string; curto: string; cls: string; Icon: typeof Info }> = {
  A: { label: "Excesso no valor a emitir", curto: "A · A emitir acima do teto", cls: "bg-warn-soft text-warn border-warn/30", Icon: AlertTriangle },
  B: { label: "Emitido acima do BGQ3", curto: "B · Emitido acima do teto", cls: "bg-crit-soft text-crit border-crit/30", Icon: OctagonAlert },
  C: { label: "Sem BGQ3", curto: "C · Sem BGQ3", cls: "bg-hyp-soft text-hyp border-hyp/30", Icon: CircleHelp },
  saldo: { label: "Saldo disponível", curto: "Saldo disponível", cls: "bg-ok-soft text-ok border-ok/30", Icon: CheckCircle2 },
  ok: { label: "Dentro do teto", curto: "Dentro do teto", cls: "bg-card-alt text-ink-muted border-line", Icon: CheckCircle2 },
};

export function ClasseTag({ c }: { c: Classe }) {
  const { curto, cls, Icon } = classeInfo[c];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      <Icon size={12} aria-hidden /> {curto}
    </span>
  );
}

export function Pergunta({ titulo, pergunta, children }: { titulo: string; pergunta: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-info">{titulo}</p>
        <h1 className="text-[26px] font-bold leading-tight mt-1">{pergunta}</h1>
      </div>
      {children}
    </div>
  );
}

/** Mensagem executiva (até 4 linhas). */
export function Mensagem({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-info/30 bg-info-soft px-5 py-4 text-[19px] leading-snug text-ink">
      {children}
    </div>
  );
}

/** Barra horizontal simples para listas de impacto. */
export function Barra({ valor, max, tone = "info" }: { valor: number; max: number; tone?: "info" | "warn" | "crit" | "ok" | "hyp" }) {
  const w = max > 0 ? Math.max(2, Math.min(100, (Math.abs(valor) / max) * 100)) : 0;
  const bg = { info: "bg-info", warn: "bg-warn", crit: "bg-crit", ok: "bg-ok", hyp: "bg-hyp" }[tone];
  return (
    <div className="h-2 w-full rounded-full bg-line-soft overflow-hidden" aria-hidden>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = 640 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full bg-card border-l border-line shadow-xl overflow-y-auto" style={{ width: `min(${width}px, 100vw)` }}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <div className="text-[17px] font-bold leading-snug">{title}</div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-card-alt" aria-label="Fechar painel">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-[13px] text-ink-faint">{children}</div>;
}

/** Bloco "o que acontece se não agirmos" */
export function Inacao({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] text-crit">
      <OctagonAlert size={14} className="mt-[1px] shrink-0" aria-hidden />
      <span><span className="font-semibold">Se nada for feito: </span>{children}</span>
    </p>
  );
}
