// Visão por ÁREA FINANCEIRA (dN4[N4]) para a tela 1.
// Duas hierarquias, cada uma no seu papel (definição do time em 08/10/2026):
//   · financeira (quem paga): NF → RC → projeto → dN4[N4]   (orçamento e rateio)
//   · alocação (quem gere a pessoa): dim_gestores (gestor N4, gerência) → filtro "Responsável"
// A demanda só ganha área financeira pelo rateio da sua NF (D05b). Sem NF = "Sem rateio".

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v) => (v === null || v === undefined ? "" : String(v).trim());
const ym = (iso) => (iso ? Number(String(iso).slice(0, 4)) * 100 + Number(String(iso).slice(5, 7)) : null);
const RUB = (r) => s(r).toUpperCase();
export const SEM_RATEIO = "Sem rateio";

/** Orçamento e caixa por N4 × rubrica × mês (D02), e o cadastro projeto → N4. */
export function orcamentoPorArea(d02) {
  const agg = new Map();
  const proj = new Map();
  for (const r of d02) {
    const n4 = s(r.N4) || "(sem N4)";
    const rub = RUB(r.Rubrica);
    const mes = n(r["Ano Mes Ordem"]);
    const k = `${n4}|${rub}|${mes}`;
    const a = agg.get(k) ?? { n4, n3: s(r.N3), rub, mes, bgq1: 0, bgq2: 0, bgq3: 0, pago: 0, futuro: 0 };
    a.bgq1 += n(r.BGQ1); a.bgq2 += n(r.BGQ2); a.bgq3 += n(r.BGQ3);
    a.pago += n(r.Realizado_NF); a.futuro += n(r.Futuro_NF_sem_operacional);
    agg.set(k, a);
    const id = s(r.IdPPM);
    if (id) {
      const p = proj.get(id) ?? { idPPM: id, projeto: s(r.NomeLB), n4, bgq3: 0, pago: 0, futuro: 0 };
      p.bgq3 += n(r.BGQ3); p.pago += n(r.Realizado_NF); p.futuro += n(r.Futuro_NF_sem_operacional);
      proj.set(id, p);
    }
  }
  const linhas = [...agg.values()].filter((a) => Math.abs(a.bgq1) + Math.abs(a.bgq2) + Math.abs(a.bgq3) + Math.abs(a.pago) + Math.abs(a.futuro) > 0.5);
  return { linhas, projetos: [...proj.values()] };
}

/**
 * Distribui cada linha de demanda pelas N4 que pagam a sua NF, na proporção do valor rateado
 * (realizado + planejado válido). Linha sem NF → área "Sem rateio".
 * Só competências a partir de `desde` (aaaamm).
 */
export function demandaPorArea(d05a, d05b, desde) {
  const porChave = new Map();
  for (const r of d05b) {
    const k = s(r.ChaveTerceiros);
    const v = n(r.Realizado) + n(r.Planejado_valido);
    if (!k || v <= 0) continue;
    const l = porChave.get(k) ?? { tot: 0, n4: new Map(), proj: new Map() };
    l.tot += v;
    const n4 = s(r.N4) || "(sem N4)";
    l.n4.set(n4, (l.n4.get(n4) ?? 0) + v);
    const pj = s(r.IdPPM_RC) || s(r.IdPPM_NF);
    if (pj) l.proj.set(pj, (l.proj.get(pj) ?? 0) + v);
    porChave.set(k, l);
  }
  const linhas = [];
  const porProjeto = new Map();
  for (const r of d05a) {
    const comp = ym(r.Competencia);
    if (comp === null || comp < desde) continue;
    const dem = n(r.Demanda);
    if (dem === 0) continue;
    const k = s(r.ChaveUnica);
    const nf = porChave.get(k);
    const base = {
      k, prof: s(r.IdProfissional), comp, rub: RUB(r.Rubrica), st: s(r.Status),
      g4: s(r.GestorN4) || "(sem gestor)", ger: s(r.Gerencia), gestor: s(r.Gestor), forn: s(r.Fornecedor),
      dem, nf: nf ? nf.tot : 0,
      cob: !nf ? "sem" : nf.tot >= dem - 1 ? "total" : "parcial",
    };
    if (!nf) { linhas.push({ ...base, n4: SEM_RATEIO, v: dem }); continue; }
    for (const [n4, v] of nf.n4) linhas.push({ ...base, n4, v: dem * (v / nf.tot) });
    for (const [pj, v] of nf.proj) porProjeto.set(pj, (porProjeto.get(pj) ?? 0) + dem * (v / nf.tot));
  }
  return { linhas, porProjeto: Object.fromEntries(porProjeto) };
}
