import type { ItemFila, Projeto } from "../types";

export type Tom = "crit" | "warn" | "info" | "hyp" | "ok" | "neutral";

/** Ação curta (tag) por projeto. O texto longo fica no painel de detalhe. */
export function acaoProjeto(p: Projeto): { tag: string; tom: Tom } {
  if (p.confianca === "Dado inconsistente") return { tag: "Corrigir cadastro", tom: "warn" };
  switch (p.categoria) {
    case "Estouro real": return { tag: "Bloquear emissão", tom: "crit" };
    case "Emitido acima do BGQ3": return { tag: "Regularizar emissão", tom: "crit" };
    case "Possível duplicidade": return { tag: "Baixar mock", tom: "info" };
    case "Mock não baixado": return { tag: "Revisar mock", tom: "warn" };
    case "Sem BGQ3": return { tag: "Confirmar orçamento", tom: "hyp" };
    case "Saldo disponível": return { tag: "Usar ou devolver saldo", tom: "ok" };
    default: return { tag: "Acompanhar", tom: "neutral" };
  }
}

/** Três pilares da tela 3; cada tipo de fila pertence a um só. */
export const PILARES: { id: string; nome: string; descricao: string; tipos: string[] }[] = [
  {
    id: "impacto", nome: "Impacto orçamentário real", descricao: "Dinheiro empenhado ou a emitir acima do teto",
    tipos: ["RC a cancelar", "RC que não deve ser emitida", "NF acima do empenho", "Projeto sem BGQ3"],
  },
  {
    id: "cadastro", nome: "Inconsistências cadastrais", descricao: "Dado errado ou duplicado na origem",
    tipos: ["Dado cadastral a corrigir", "Mock a baixar", "Possível duplicidade de planejamento", "Possível duplicidade de NF"],
  },
  {
    id: "rateio", nome: "Pendências de rateio", descricao: "Demanda ou NF sem projeto que pague",
    tipos: ["Demanda sem rateio", "Demanda com rateio parcial", "NF para re-rateio", "Item aguardando validação"],
  },
];

const TAG_FILA: Record<string, { tag: string; tom: Tom }> = {
  "RC a cancelar": { tag: "Cancelar saldo", tom: "crit" },
  "RC que não deve ser emitida": { tag: "Bloquear emissão", tom: "crit" },
  "NF acima do empenho": { tag: "Ajustar empenho", tom: "warn" },
  "Projeto sem BGQ3": { tag: "Confirmar orçamento", tom: "hyp" },
  "Dado cadastral a corrigir": { tag: "Corrigir cadastro", tom: "warn" },
  "Mock a baixar": { tag: "Baixar mock", tom: "info" },
  "Possível duplicidade de planejamento": { tag: "Revisar mock", tom: "warn" },
  "Possível duplicidade de NF": { tag: "Conferir NF", tom: "neutral" },
  "Demanda sem rateio": { tag: "Definir projeto", tom: "crit" },
  "Demanda com rateio parcial": { tag: "Completar rateio", tom: "warn" },
  "NF para re-rateio": { tag: "Ajustar rateio", tom: "warn" },
  "Item aguardando validação": { tag: "Validar saldo", tom: "neutral" },
};
export const acaoFila = (f: ItemFila) => TAG_FILA[f.tipo] ?? { tag: f.tipo, tom: "neutral" as Tom };

/** Chave estável de uma linha de fila (para registrar a decisão). */
export const chaveFila = (f: ItemFila) => `${f.tipo}|${f.idPPM}|${f.rc}|${f.projeto}`;
