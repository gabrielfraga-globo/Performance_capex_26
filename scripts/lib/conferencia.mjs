// Conferência de fidelidade ao modelo: as consultas abertas (D02, D05a) precisam fechar com a consulta
// agregada R26, que usa as mesmas medidas do BI. Se não fecharem, o painel avisa e o script de atualização
// não publica. Tolerância: R$ 1 por mês.
const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ym = (iso) => (iso ? Number(String(iso).slice(0, 4)) * 100 + Number(String(iso).slice(5, 7)) : null);

export function conferir(dados, ciclo) {
  const itens = [];
  const somaPorMes = (rows, mesDe, valor, filtro = () => true) => {
    const m = new Map();
    for (const r of rows ?? []) {
      if (!filtro(r)) continue;
      const k = mesDe(r);
      if (k === null || k < ciclo.de) continue;
      m.set(k, (m.get(k) ?? 0) + valor(r));
    }
    return m;
  };
  const comparar = (nome, a, b) => {
    const meses = [...new Set([...a.keys(), ...b.keys()])].sort();
    const dif = meses.map((mes) => ({ mes, a: a.get(mes) ?? 0, b: b.get(mes) ?? 0 })).filter((x) => Math.abs(x.a - x.b) > 1);
    const totA = [...a.values()].reduce((s, v) => s + v, 0), totB = [...b.values()].reduce((s, v) => s + v, 0);
    itens.push({ nome, ok: dif.length === 0, total: totB, diferenca: totA - totB, mesesDivergentes: dif.map((x) => x.mes) });
  };
  const mesR26 = (r) => n(r["Ano Mes Ordem"]) || null;
  comparar("BGQ3 (D02 × R26)", somaPorMes(dados.D02, mesR26, (r) => n(r.BGQ3)), somaPorMes(dados.R26, mesR26, (r) => n(r.BGQ3)));
  comparar("Realizado (D02 × R26)", somaPorMes(dados.D02, mesR26, (r) => n(r.Realizado_NF)), somaPorMes(dados.R26, mesR26, (r) => n(r.Realizado_NF)));
  comparar("NF futura (D02 × R26)", somaPorMes(dados.D02, mesR26, (r) => n(r.Futuro_NF_sem_operacional)), somaPorMes(dados.R26, mesR26, (r) => n(r.Futuro_NF_sem_operacional)));
  comparar("Demanda (D05a × R26)", somaPorMes(dados.D05a, (r) => ym(r.CaixaPrevista), (r) => n(r.Demanda)), somaPorMes(dados.R26, mesR26, (r) => n(r.Demanda_ativa_CAPEX)));
  return { ok: itens.every((x) => x.ok), itens };
}
