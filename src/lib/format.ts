const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const mes = (ym: number) => `${MESES[(ym % 100) - 1]}/${String(Math.floor(ym / 100)).slice(2)}`;
export const mesLongo = (ym: number) => `${MESES_LONGOS[(ym % 100) - 1]} de ${Math.floor(ym / 100)}`;

/** Ruptura: "meados de mar/27" a partir do mês + fração. */
export function quando(r: { mes: number; fracao: number } | null): string {
  if (!r) return "—";
  const parte = r.fracao < 0.25 ? "início de" : r.fracao < 0.75 ? "meados de" : "fim de";
  return `${parte} ${mes(r.mes)}`;
}

/** R$ em milhões ("R$ 9,55 mi"), mil ("R$ 939 mil") ou unidades. */
export function brl(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a < 0.5) return "R$ 0";
  const sinal = v < 0 ? "−" : "";
  if (a >= 1e6) return `${sinal}R$\u00a0${(a / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}\u00a0mi`;
  if (a >= 1e3) return `${sinal}R$\u00a0${Math.round(a / 1e3).toLocaleString("pt-BR")}\u00a0mil`;
  return `${sinal}R$\u00a0${Math.round(a).toLocaleString("pt-BR")}`;
}

export const brlCheio = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const mi = (v: number, casas = 1) => (v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const num = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pct = (v: number | null | undefined, casas = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
export const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const addMes = (ym: number, k: number) => {
  const y = Math.floor(ym / 100), m = (ym % 100) - 1 + k;
  return (y + Math.floor(m / 12)) * 100 + (((m % 12) + 12) % 12) + 1;
};
