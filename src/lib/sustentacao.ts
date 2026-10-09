/**
 * Sustentação do orçamento no ciclo (decisões do time em 08/10/2026):
 *   OQ-H1  Orçamento disponível = BG aprovado − realizado − valores já em pagamento (NF do mês corrente).
 *   OQ-H2  Ciclo jan/26 → mar/27 (revisado em 09/10); o que vem depois é "além do ciclo" e não entra na conta.
 *   OQ-H3  Só dois estados: coberto / não coberto.
 *   OQ-H4  Cobertura = meses do ciclo sustentados pelo BG total, pelo consumo acumulado.
 * Só soma valores das extrações D02 e D05a. Nenhuma estimativa.
 */
export interface LinhaSust { rub: string; mes: number; n3: string; n4: string; def: string | null; bgq1: number; bgq2: number; bgq3: number; realizado: number; nfFutura: number; demanda: number; demandaPago: number }
export interface Sustentacao { ciclo: { de: number; ate: number }; mesCorrente: number; temDefesa?: boolean; linhas: LinhaSust[]; atribuicao?: { umaArea: number; variasAreas: number; semNF: number } }
export type Cenario = "bgq1" | "bgq2" | "bgq3";
export interface MesSust { mes: number; tipo: "realizado" | "corrente" | "demanda"; orcamento: number; orcamentoAcum: number; consumo: number; acumulado: number; coberto: boolean }

export function mesesEntre(de: number, ate: number): number[] {
  const out: number[] = [];
  let a = Math.floor(de / 100), m = de % 100;
  while (a * 100 + m <= ate) { out.push(a * 100 + m); m++; if (m > 12) { m = 1; a++; } }
  return out;
}

export function consolidar(sus: Sustentacao, cenario: Cenario = "bgq3", rubrica: string | null = null, diretoria: string | null = null, area: string | null = null, defesa: string | null = null) {
  const { ciclo, mesCorrente } = sus;
  const ls = sus.linhas.filter((l) => (!rubrica || l.rub === rubrica) && (!diretoria || l.n3 === diretoria) && (!area || l.n4 === area) && (!defesa || l.def === defesa));
  const soma = (f: (l: LinhaSust) => number, ok: (l: LinhaSust) => boolean) => ls.filter(ok).reduce((t, l) => t + f(l), 0);
  const dentro = (l: LinhaSust) => l.mes >= ciclo.de && l.mes <= ciclo.ate;

  const bg = soma((l) => l[cenario], dentro);
  const realizado = soma((l) => l.realizado, (l) => dentro(l) && l.mes <= mesCorrente);
  const emPagamento = soma((l) => l.nfFutura, (l) => l.mes === mesCorrente);
  const disponivel = bg - realizado - emPagamento;
  const futuro = (l: LinhaSust) => l.mes > mesCorrente && l.mes <= ciclo.ate;
  const demandaFutura = soma((l) => l.demanda, futuro);
  const pagoExcluido = soma((l) => l.demandaPago, futuro);
  const resultado = disponivel - demandaFutura;

  let acum = 0, orcAcum = 0;
  const serie: MesSust[] = mesesEntre(ciclo.de, ciclo.ate).map((mes) => {
    const doMes = ls.filter((l) => l.mes === mes);
    const tipo: MesSust["tipo"] = mes < mesCorrente ? "realizado" : mes === mesCorrente ? "corrente" : "demanda";
    const consumo = doMes.reduce((t, l) => t + (tipo === "realizado" ? l.realizado : tipo === "corrente" ? l.realizado + l.nfFutura : l.demanda), 0);
    acum += consumo;
    const orcamento = doMes.reduce((t, l) => t + l[cenario], 0);
    orcAcum += orcamento;
    return { mes, tipo, orcamento, orcamentoAcum: orcAcum, consumo, acumulado: acum, coberto: acum <= bg + 0.5 };
  });
  let mesesSustentados = 0;
  for (const x of serie) { if (!x.coberto) break; mesesSustentados++; }

  const alem = ls.filter((l) => l.mes > ciclo.ate);
  return {
    bg, realizado, emPagamento, disponivel, demandaFutura, pagoExcluido, resultado,
    coberto: resultado >= 0,
    serie, mesesSustentados, totalMeses: serie.length,
    sustentaAte: mesesSustentados > 0 ? serie[mesesSustentados - 1].mes : null,
    primeiroDescoberto: serie[mesesSustentados]?.mes ?? null,
    alemDoCiclo: {
      nf: alem.reduce((t, l) => t + l.nfFutura, 0),
      meses: [...new Set(alem.filter((l) => l.nfFutura > 0.5).map((l) => l.mes))].sort((a, b) => a - b),
    },
  };
}
export const diretorias = (sus: Sustentacao) => [...new Set(sus.linhas.map((l) => l.n3))].filter((d) => d !== "(sem diretoria)").sort();
export const SEM_AREA = "Sem área";
export const SEM_PROJETO = "Sem projeto";
/** Safras de defesa presentes (vazio enquanto a D02 não trouxer a coluna Defesa). */
export const defesas = (sus: Sustentacao) => {
  if (!sus.temDefesa) return [] as string[];
  const xs = [...new Set(sus.linhas.map((l) => l.def).filter((d): d is string => !!d))];
  return [...xs.filter((d) => d !== SEM_PROJETO).sort(), ...(xs.includes(SEM_PROJETO) ? [SEM_PROJETO] : [])];
};
/** Áreas (N4) presentes, opcionalmente só as de uma diretoria; "Sem área" (demanda sem NF) por último. */
export const areas = (sus: Sustentacao, diretoria: string | null = null) => {
  const xs = [...new Set(sus.linhas.filter((l) => !diretoria || l.n3 === diretoria).filter((l) => Math.abs(l.bgq3) + Math.abs(l.demanda) + Math.abs(l.realizado) > 0.5).map((l) => l.n4))];
  return [...xs.filter((a) => a !== SEM_AREA).sort(), ...(xs.includes(SEM_AREA) ? [SEM_AREA] : [])];
};
export type Consolidado = ReturnType<typeof consolidar>;

/**
 * Simulação de remanejamento (OQ-R1, 09/10/2026: só como estudo, aprovação do diretor).
 * Soma `delta` ao BG do recorte (positivo = recebe, negativo = cede) e recalcula o resultado e os meses
 * sustentados sobre o mesmo consumo acumulado. Não altera os dados; o total da operação não muda.
 */
export function comAjuste(c: Consolidado, delta: number) {
  const bg = c.bg + delta;
  let meses = 0;
  for (const s of c.serie) { if (s.acumulado > bg + 0.5) break; meses++; }
  return {
    resultado: c.resultado + delta,
    coberto: c.resultado + delta >= 0,
    mesesSustentados: meses,
    sustentaAte: meses > 0 ? c.serie[meses - 1].mes : null,
  };
}
