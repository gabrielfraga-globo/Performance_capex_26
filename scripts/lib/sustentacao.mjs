// Sustentação do orçamento no ciclo (decisões do time em 08/10/2026):
//   OQ-H1  Orçamento disponível = BG aprovado − realizado − valores já em pagamento (NF do mês corrente).
//          A NF futura dos meses seguintes NÃO é descontada: o consumo futuro é a demanda.
//   OQ-H2  Ciclo jan/26 → mar/27 (revisado em 09/10). O que cai depois de mar/27 é "além do ciclo", fora da conta.
//   OQ-H4  Cobertura = por quantos meses do ciclo o BG total sustenta o consumo acumulado
//          (realizado nos meses fechados; realizado + em pagamento no mês corrente; demanda depois).
// Fontes: D02 (BG, realizado, NF por mês de caixa) e D05a (demanda por mês de caixa previsto).
// Diretoria (N3): orçamento por dN4[N3] (D02); demanda por ListaGestaoTerceiros[Diretoria] (D05a), ligada a aux_n3 no modelo.
//   Conferido em 08/10/2026: em 100% da demanda com NF (R$ 10,53 mi) a diretoria da lista = N3 da NF.
// Conferência: demanda + demandaPago por mês de caixa (D05a) = R26[Demanda_ativa_CAPEX] (teste).

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v) => (v === null || v === undefined ? "" : String(v).trim());
const ym = (iso) => (iso ? Number(String(iso).slice(0, 4)) * 100 + Number(String(iso).slice(5, 7)) : null);
const RUB = (r) => s(r).toUpperCase();
const N3 = (v) => s(v).replace(/\s+/g, " ") || "(sem diretoria)";
export const SEM_AREA = "Sem área";
export const SEM_PROJETO = "Sem projeto";
// Defesa (safra do projeto): dProjetos[Defesa] = "Nova Iniciativa" (AnoDefesa 2026) ou "Plurianual".
// Orçamento: coluna Defesa da D02 (por projeto). Demanda: defesa do projeto da RC que paga o profissional
// (mesma ponte da área). Sem NF → "Sem projeto". Se a D02 ainda não trouxer a coluna, defesa = null.

/**
 * OQ-A1 (decisão 09/10/2026): a área (N4) da demanda é a área do PROJETO DA RC que paga o profissional.
 * Quando o profissional é pago por várias RCs de projetos de áreas diferentes, cada RC leva a sua parte,
 * na proporção do valor da NF daquela RC (realizado + planejado válido). Sem NF → "Sem área".
 */
function areasPorRC(d05b, defesaProj) {
  const m = new Map();
  for (const r of d05b) {
    const k = s(r.ChaveTerceiros);
    const v = n(r.Realizado) + n(r.Planejado_valido);
    if (!k || v <= 0) continue;
    const n4 = s(r.N4) || SEM_AREA;
    const def = defesaProj ? defesaProj.get(s(r.IdPPM_RC) || s(r.IdPPM_NF)) ?? SEM_PROJETO : null;
    const chave = `${n4}\u0001${def ?? ""}`;
    const x = m.get(k) ?? new Map();
    x.set(chave, (x.get(chave) ?? 0) + v);
    m.set(k, x);
  }
  const pesos = new Map();
  for (const [k, x] of m) {
    const tot = [...x.values()].reduce((a, b) => a + b, 0);
    pesos.set(k, [...x].map(([chave, v]) => { const [n4, def] = chave.split("\u0001"); return [n4, def || null, v / tot]; }));
  }
  return pesos;
}

/** Linhas por rubrica × mês de caixa, do início do ciclo até o último mês com NF ou demanda. */
export function sustentacao(d02, d05a, ciclo, mesCorrente, d05b = [], corteDivida = null) {
  const temDefesa = d02.some((r) => s(r.Defesa) !== "");
  const defesaProj = temDefesa ? new Map(d02.filter((r) => s(r.IdPPM)).map((r) => [s(r.IdPPM), s(r.Defesa) || SEM_PROJETO])) : null;
  const pesos = areasPorRC(d05b, defesaProj);
  const agg = new Map();
  const get = (rub, mes, n3, n4, def) => {
    const k = `${rub}|${mes}|${n3}|${n4}|${def}`;
    let a = agg.get(k);
    if (!a) { a = { rub, mes, n3, n4, def, bgq1: 0, bgq2: 0, bgq3: 0, realizado: 0, nfFutura: 0, demanda: 0, demandaPago: 0, pendenciaVencida: 0, pendenciaCorrente: 0 }; agg.set(k, a); }
    return a;
  };
  for (const r of d02) {
    const mes = n(r["Ano Mes Ordem"]);
    if (mes < ciclo.de) continue;
    const a = get(RUB(r.Rubrica), mes, N3(r.N3), s(r.N4) || SEM_AREA, temDefesa ? s(r.Defesa) || SEM_PROJETO : null);
    a.bgq1 += n(r.BGQ1); a.bgq2 += n(r.BGQ2); a.bgq3 += n(r.BGQ3);
    a.realizado += n(r.Realizado_NF); a.nfFutura += n(r.Futuro_NF_sem_operacional);
  }
  const realizadoPorChave = new Map();
  const nfCorrentePorChave = new Map();
  for (const r of d05b) {
    const k = s(r.ChaveTerceiros);
    if (!k) continue;
    realizadoPorChave.set(k, (realizadoPorChave.get(k) ?? 0) + n(r.Realizado));
    if (ym(r.CaixaPrevista) === mesCorrente) nfCorrentePorChave.set(k, (nfCorrentePorChave.get(k) ?? 0) + n(r.Planejado_valido));
  }
  for (const r of d05a) {
    const mes = ym(r.CaixaPrevista);
    if (mes === null || mes < ciclo.de) continue;
    const chave = s(r.ChaveUnica);
    // Linhas "Pago" já estão no realizado (D05a × D05b em 08/10/2026: 36 linhas, NF realizada = demanda).
    // Contá-las como demanda futura somaria o mesmo dinheiro duas vezes. Ficam separadas, para conferência (V03).
    const fatias = pesos.get(s(r.ChaveUnica)) ?? [[SEM_AREA, temDefesa ? SEM_PROJETO : null, 1]];
    for (const [n4, def, f] of fatias) {
      const a = get(RUB(r.Rubrica), mes, N3(r.Diretoria), n4, def);
      if (s(r.Status) === "Pago") a.demandaPago += n(r.Demanda) * f;
      else a.demanda += n(r.Demanda) * f;
      if (corteDivida !== null && s(r.Status) === "A Pagar" && (realizadoPorChave.get(chave) ?? 0) <= 0) {
        if (mes >= corteDivida && mes < mesCorrente) a.pendenciaVencida += n(r.Demanda) * f;
        else if (mes === mesCorrente) a.pendenciaCorrente += Math.max(0, n(r.Demanda) - (nfCorrentePorChave.get(chave) ?? 0)) * f;
      }
    }
  }
  const linhas = [...agg.values()].sort((x, y) => x.mes - y.mes || x.rub.localeCompare(y.rub) || x.n3.localeCompare(y.n3) || x.n4.localeCompare(y.n4));
  return { ciclo, mesCorrente, temDefesa, linhas };
}
// A consolidação (cenário, rubrica, meses sustentados) fica em src/lib/sustentacao.ts, usada pela tela e pelos testes.

/**
 * Perfil da atribuição de área (N4) da demanda futura do ciclo: quanto é pago por 1 área (exato),
 * quanto é rateado entre várias (depende da regra OQ-A1) e quanto não tem NF.
 */
export function perfilAtribuicao(d05a, d05b, ciclo, mesCorrente) {
  const n4s = new Map();
  for (const r of d05b) {
    const k = s(r.ChaveTerceiros);
    const v = n(r.Realizado) + n(r.Planejado_valido);
    if (!k || v <= 0) continue;
    const m = n4s.get(k) ?? new Set();
    m.add(s(r.N4));
    n4s.set(k, m);
  }
  const out = { umaArea: 0, variasAreas: 0, semNF: 0 };
  for (const r of d05a) {
    const mes = ym(r.CaixaPrevista);
    if (mes === null || mes <= mesCorrente || mes > ciclo.ate || s(r.Status) === "Pago") continue;
    const m = n4s.get(s(r.ChaveUnica));
    if (!m) out.semNF += n(r.Demanda);
    else if (m.size === 1) out.umaArea += n(r.Demanda);
    else out.variasAreas += n(r.Demanda);
  }
  return out;
}
