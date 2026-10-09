import type { Bundle, Projeto } from "../types";
import { brl, num, pct, quando } from "./format";

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

/** Decomposição da exposição acima do teto, sem misturar categorias (regra do storyline). */
export function exposicao(projetos: Projeto[]) {
  const A = projetos.filter((x) => x.classe === "A");
  const B = projetos.filter((x) => x.classe === "B");
  const C = projetos.filter((x) => x.classe === "C");
  const acima = [...A, ...B, ...C];
  return {
    bruta: sum(acima, (x) => x.excesso),
    projetos: acima.length,
    duplicidadeForte: sum([...A, ...B], (x) => x.explicadoForte),
    aValidar: sum([...A, ...B], (x) => x.explicadoValidar),
    estouroRealA: sum(A, (x) => x.estouroReal),
    emitidoAcimaB: sum(B, (x) => x.estouroReal),
    semBGQ3: sum(C, (x) => x.excesso),
    A, B, C,
    saldo: projetos.filter((x) => x.classe === "saldo"),
  };
}

export function decisaoAgora(b: Bundle) {
  const itens = b.agenda.filter((i) => i.grupo === "Decidir agora" && i.id !== "reforco-ou-reducao");
  return { valor: sum(itens, (i) => i.impacto), itens: itens.length };
}

export function compromisso(b: Bundle) {
  const c = b.cobertura.RESERVAS;
  return c.realizado + c.nfFuturaTotal;
}

/** Mensagem executiva gerada a partir dos números (até 4 frases). */
export function narrativa(b: Bundle): string[] {
  const r = b.cobertura.RESERVAS, m = b.cobertura.MDO;
  const a26 = r.porAno.find((a) => a.ano === 2026)!, a27 = r.porAno.find((a) => a.ano === 2027)!;
  const e = exposicao(b.projetos);
  const s26 = a26.saldo >= 0 ? `fecha com sobra de ${brl(a26.saldo)}` : `fecha com falta de ${brl(-a26.saldo)}`;
  const s27 = a27.saldo < 0 ? `já faltam ${brl(-a27.saldo)} só com o que está planejado` : `há sobra de ${brl(a27.saldo)}`;
  const explicado = e.duplicidadeForte + e.aValidar;
  return [
    `2026 ${s26} sobre o compromisso consolidado, mas o risco está em 2027: ${s27}.`,
    `O saldo sustenta ~${num(m.meses)} meses da demanda atual de MDO (ruptura estimada em ${quando(m.rupturaMes)}).`,
    `Dos ${brl(e.bruta)} acima do teto em ${e.projetos} projetos, ${brl(explicado)} vêm de mocks e possíveis duplicidades${e.aValidar > 0 ? ` (${brl(e.aValidar)} ainda a validar)` : ""}.`,
    `Para atravessar ${b.parametros.horizonteMeses} meses sem reforço, a demanda de MDO precisaria cair ~${pct(m.reducaoNecessaria)}: hipótese para discussão, não regra.`,
  ];
}
