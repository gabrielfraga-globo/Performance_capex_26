// Regressão das regras contra os números validados em 08/10/2026
// (auditoria/Respostas_Negocio_BG_Reservas.md). Usa os CSVs de public/data.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { parseCsv, parseValue } from "../scripts/lib/csv.mjs";
import { construir, resolverParametros, FONTES } from "../scripts/buildBundle.mjs";

const cfg = JSON.parse(fs.readFileSync("config/parametros.json", "utf8"));
const p = resolverParametros(cfg, { data: "2026-10-08" });
const dados = {};
for (const f of FONTES) {
  const file = `public/data/${f.arquivo}.csv`;
  dados[f.id] = fs.existsSync(file) ? parseCsv(fs.readFileSync(file, "utf8")) : null;
}
const b = construir(dados, p);
const mi = (v) => Math.round(v / 1e4) / 100;

describe("CSV pt-BR", () => {
  it("lê número, texto entre aspas, data e vazio", () => {
    expect(parseValue({ v: "1234,56", q: false })).toBe(1234.56);
    expect(parseValue({ v: "5,8207660913467407E-11", q: false })).toBeCloseTo(5.82e-11);
    expect(parseValue({ v: "25939", q: true })).toBe("25939");
    expect(parseValue({ v: "2026-11-01 00:00:00,000", q: false })).toBe("2026-11-01");
    expect(parseValue({ v: "", q: false })).toBeNull();
  });
});

describe("parâmetros relativos à data", () => {
  it("08/10/2026 → caixa out/26, demanda out/26–fev/27, custo fev–set/26", () => {
    expect(p.mesCorrenteCaixa).toBe(202610);
    expect(p.janelaDemanda).toEqual({ de: 202610, ate: 202702 });
    expect(p.janelaCustoPosition).toEqual({ de: 202602, ate: 202609 });
  });
});

describe("cobertura (regras 5 e 6)", () => {
  it("Reservas: BGQ3 31,44 · realizado 18,32 · 2026 +1,74 · 2027 −0,80", () => {
    const r = b.cobertura.RESERVAS;
    expect(mi(r.bgq3)).toBe(31.44);
    expect(mi(r.realizado)).toBe(18.32);
    expect(mi(r.porAno[0].saldo)).toBe(1.74);
    expect(mi(r.porAno[1].saldo)).toBe(-0.8);
    expect(mi(r.saldoDemanda)).toBe(12.14);
  });
  it("MDO: saldo 9,55 ÷ 1,79/mês = 5,3 meses; redução ~56%", () => {
    const m = b.cobertura.MDO;
    expect(mi(m.saldoDemanda)).toBe(9.55);
    expect(mi(m.demandaMedia)).toBe(1.79);
    expect(m.meses).toBeCloseTo(5.33, 1);
    expect(Math.round(m.reducaoNecessaria * 100)).toBe(56);
    expect(m.comBGQ1.meses).toBeCloseTo(7.67, 1);
  });
});

describe("RCs e projetos (P1)", () => {
  it("RCs a cancelar: R$ 939 mil; aguardando: R$ 232 mil; re-ratear: R$ 81 mil", () => {
    const s = (f) => b.rcs.reduce((a, r) => a + f(r), 0);
    expect(Math.round(s((r) => r.aCancelar) / 1e3)).toBe(939);
    expect(Math.round(s((r) => r.naoEmitir) / 1e3)).toBe(232);
    expect(Math.round(s((r) => r.reRatear) / 1e3)).toBe(81);
  });
  it("dado do BI sem correção manual: 25 projetos acima do BGQ3 (A 16 / B 6 / C 3), R$ 5,70 mi", () => {
    const g = (c) => b.projetos.filter((x) => x.classe === c);
    expect([g("A").length, g("B").length, g("C").length]).toEqual([16, 6, 3]);
    expect(mi([...g("A"), ...g("B"), ...g("C")].reduce((a, x) => a + x.excesso, 0))).toBe(5.7);
    expect(mi(g("A").reduce((a, x) => a + x.excesso, 0))).toBe(2.9);
    expect(b.correcoesAplicadas).toHaveLength(0);
  });
  it("erro de digitação da RCGRJ10680852 aparece como dado a corrigir, não corrigido", () => {
    expect(b.filas.some((f) => f.tipo === "Dado cadastral a corrigir" && f.rc === "RCGRJ10680852")).toBe(true);
    expect(b.projetos.find((x) => x.idPPM === "25939").confianca).toBe("Dado inconsistente");
  });
  it("explicação do excesso nunca passa do excesso", () => {
    for (const x of b.projetos) expect(x.explicadoForte + x.explicadoValidar + x.estouroReal).toBeLessThanOrEqual(x.excesso + 0.01);
  });
});

describe("áreas financeiras (D02 + D05)", () => {
  it("orçamento por área fecha com a R26 e a demanda fecha com a R25", () => {
    const a = b.areas;
    expect(mi(a.orcamento.reduce((s, o) => s + o.bgq3, 0))).toBe(31.44);
    const fut = a.demanda.reduce((s, d) => s + d.v, 0);
    expect(mi(fut)).toBe(12.93);
  });
  it("cada linha de demanda é distribuída sem perder valor", () => {
    const porChave = new Map();
    for (const d of b.areas.demanda) porChave.set(d.k, (porChave.get(d.k) ?? 0) + d.v);
    for (const d of b.areas.demanda) expect(porChave.get(d.k)).toBeCloseTo(d.dem, 2);
  });
});

describe("sustentação no ciclo jan/26 → mar/27 (OQ-H1, H2 revisada, H4)", async () => {
  const { consolidar } = await import("../src/lib/sustentacao.ts");
  const s = b.sustentacao;
  it("demanda por mês de caixa (D05a, com 'Pago') fecha com R26[Demanda_ativa_CAPEX]", () => {
    const r26 = new Map();
    for (const r of dados.R26) r26.set(r["Ano Mes Ordem"], (r26.get(r["Ano Mes Ordem"]) ?? 0) + (r.Demanda_ativa_CAPEX ?? 0));
    for (const mes of [202611, 202612, 202701, 202702, 202703]) {
      const d = s.linhas.filter((l) => l.mes === mes).reduce((t, l) => t + l.demanda + l.demandaPago, 0);
      expect(Math.abs(d - r26.get(mes))).toBeLessThan(1);
    }
  });
  it("BGQ3: disponível 12,14 = 31,44 − 18,32 − 0,97; demanda futura 11,70; cobre com +0,44 (15/15 meses)", () => {
    const k = consolidar(s, "bgq3");
    expect(mi(k.bg)).toBe(31.44);
    expect(mi(k.realizado)).toBe(18.32);
    expect(mi(k.emPagamento)).toBe(0.97);
    expect(mi(k.disponivel)).toBe(12.14);
    expect(mi(k.demandaFutura)).toBe(11.7);
    expect(mi(k.pagoExcluido)).toBe(0.78);
    expect(k.coberto).toBe(true);
    expect(k.mesesSustentados).toBe(15);
    expect(mi(k.alemDoCiclo.nf)).toBe(0.8);
    expect(k.alemDoCiclo.meses).toEqual([202704]);
  });
  it("por rubrica: MDO sobra 1,37; Instalação falta 0,70 (até dez/26); Reserva falta 0,24 (até jan/27)", () => {
    const m = consolidar(s, "bgq3", "MDO"), i = consolidar(s, "bgq3", "INSTALAÇÃO"), r = consolidar(s, "bgq3", "RESERVA");
    expect(mi(m.resultado)).toBe(1.37);
    expect(mi(i.resultado)).toBe(-0.7);
    expect(i.sustentaAte).toBe(202612);
    expect(mi(r.resultado)).toBe(-0.24);
    expect(r.sustentaAte).toBe(202701);
    expect(m.resultado + i.resultado + r.resultado).toBeCloseTo(consolidar(s, "bgq3").resultado, 2);
  });
});

describe("diretoria (N3): orçamento por dN4[N3], demanda por ListaGestaoTerceiros[Diretoria]", async () => {
  const { consolidar, diretorias } = await import("../src/lib/sustentacao.ts");
  const s = b.sustentacao;
  it("duas diretorias; Produção falta 0,66 (14/15 meses, até fev/27) e Entrega sobra 1,09; somam o total", () => {
    expect(diretorias(s)).toEqual(["Plataformas De Entrega", "Plataformas De Produção"]);
    const p = consolidar(s, "bgq3", null, "Plataformas De Produção"), e = consolidar(s, "bgq3", null, "Plataformas De Entrega");
    expect(mi(p.resultado)).toBe(-0.66);
    expect(p.mesesSustentados).toBe(14);
    expect(mi(e.resultado)).toBe(1.09);
    expect(p.resultado + e.resultado).toBeCloseTo(consolidar(s, "bgq3").resultado, 2);
  });
  it("incluir jan–mar/26 não muda o disponível: o BG desses meses é igual ao realizado (BG vivo)", () => {
    const k = consolidar(s, "bgq3");
    const tri = k.serie.filter((x) => x.mes <= 202603);
    const bgTri = tri.reduce((t, x) => t + x.orcamento, 0), realTri = tri.reduce((t, x) => t + x.consumo, 0);
    expect(Math.abs(bgTri - realTri)).toBeLessThan(5000);
  });
  it("série mensal: orçamento acumulado no fim do ciclo = BG do ciclo", () => {
    const k = consolidar(s, "bgq3");
    expect(k.serie.at(-1).orcamentoAcum).toBeCloseTo(k.bg, 2);
  });
});

describe("perfil de atribuição por área (OQ-A1)", () => {
  it("1 área 9,27 · várias 1,26 · sem NF 1,18 = demanda futura 11,70", () => {
    const a = b.sustentacao.atribuicao;
    expect(mi(a.umaArea)).toBe(9.27);
    expect(mi(a.variasAreas)).toBe(1.26);
    expect(mi(a.semNF)).toBe(1.18);
    expect(mi(a.umaArea + a.variasAreas + a.semNF)).toBe(11.7);
  });
});

describe("área (N4) pela área do projeto da RC (OQ-A1, 09/10/2026)", async () => {
  const { consolidar, areas, SEM_AREA } = await import("../src/lib/sustentacao.ts");
  const s = b.sustentacao;
  it("áreas somam o total; 'Sem área' = demanda sem NF R$ 1,18 mi; Exibição sobra 1,30", () => {
    const lst = areas(s);
    expect(lst.at(-1)).toBe(SEM_AREA);
    const soma = lst.reduce((t, a) => t + consolidar(s, "bgq3", null, null, a).resultado, 0);
    expect(soma).toBeCloseTo(consolidar(s, "bgq3").resultado, 2);
    const dem = lst.reduce((t, a) => t + consolidar(s, "bgq3", null, null, a).demandaFutura, 0);
    expect(dem).toBeCloseTo(consolidar(s, "bgq3").demandaFutura, 2);
    expect(mi(consolidar(s, "bgq3", null, null, SEM_AREA).demandaFutura)).toBe(1.18);
    expect(mi(consolidar(s, "bgq3", null, null, "PLAT. DE EXIBIÇÃO").resultado)).toBe(1.3);
  });
});

describe("simulação de remanejamento (OQ-R1: estudo, não default)", async () => {
  const { consolidar, comAjuste } = await import("../src/lib/sustentacao.ts");
  const s = b.sustentacao;
  it("Entrega → Produção R$ 657 mil: Produção passa a 15/15 meses, Entrega segue coberta, total não muda", () => {
    const p = consolidar(s, "bgq3", null, "Plataformas De Produção"), e = consolidar(s, "bgq3", null, "Plataformas De Entrega");
    const v = -p.resultado;
    const p2 = comAjuste(p, v), e2 = comAjuste(e, -v);
    expect(p2.resultado).toBeCloseTo(0, 2);
    expect(p2.mesesSustentados).toBe(15);
    expect(e2.coberto).toBe(true);
    expect(p2.resultado + e2.resultado).toBeCloseTo(p.resultado + e.resultado, 2);
  });
});

describe("defesa (safra do projeto)", async () => {
  const { sustentacao } = await import("../scripts/lib/sustentacao.mjs");
  const { consolidar, defesas } = await import("../src/lib/sustentacao.ts");
  it("sem a coluna Defesa na D02 o filtro fica desligado e nada muda", () => {
    expect(b.sustentacao.temDefesa).toBe(false);
    expect(defesas(b.sustentacao)).toEqual([]);
  });
  it("com a coluna, a demanda segue a defesa do projeto da RC e as safras somam o total (estrutura, não dado real)", () => {
    const ciclo = { de: 202604, ate: 202703 };
    const d02 = [
      { N3: "P", N4: "A", IdPPM: "1", Defesa: "Nova Iniciativa", Rubrica: "MDO", "Ano Mes Ordem": 202611, BGQ1: 0, BGQ2: 0, BGQ3: 100, Realizado_NF: 0, Futuro_NF_sem_operacional: 0 },
      { N3: "P", N4: "A", IdPPM: "2", Defesa: "Plurianual", Rubrica: "MDO", "Ano Mes Ordem": 202611, BGQ1: 0, BGQ2: 0, BGQ3: 50, Realizado_NF: 0, Futuro_NF_sem_operacional: 0 },
    ];
    const d05a = [
      { ChaveUnica: "x", CaixaPrevista: "2026-11-01", Rubrica: "MDO", Status: "A Pagar", Diretoria: "P", Demanda: 90 },
      { ChaveUnica: "y", CaixaPrevista: "2026-11-01", Rubrica: "MDO", Status: "A Pagar", Diretoria: "P", Demanda: 10 },
    ];
    const d05b = [
      { ChaveTerceiros: "x", IdPPM_RC: "1", N4: "A", Realizado: 0, Planejado_valido: 30 },
      { ChaveTerceiros: "x", IdPPM_RC: "2", N4: "A", Realizado: 0, Planejado_valido: 60 },
    ];
    const s = sustentacao(d02, d05a, ciclo, 202610, d05b);
    expect(s.temDefesa).toBe(true);
    expect(defesas(s)).toEqual(["Nova Iniciativa", "Plurianual", "Sem projeto"]);
    const ni = consolidar(s, "bgq3", null, null, null, "Nova Iniciativa"), pl = consolidar(s, "bgq3", null, null, null, "Plurianual"), sp = consolidar(s, "bgq3", null, null, null, "Sem projeto");
    expect(ni.demandaFutura).toBeCloseTo(30, 6);
    expect(pl.demandaFutura).toBeCloseTo(60, 6);
    expect(sp.demandaFutura).toBeCloseTo(10, 6);
    expect(ni.resultado + pl.resultado + sp.resultado).toBeCloseTo(consolidar(s, "bgq3").resultado, 6);
  });
});
