// Pendências de demanda 'A Pagar' com dados sintéticos (mês corrente 202610, corte 202608).
import { describe, expect, it } from "vitest";
import { sustentacao } from "../scripts/lib/sustentacao.mjs";
import { consolidar } from "../src/lib/sustentacao";

const CICLO = { de: 202601, ate: 202703 };
const MES = 202610;
const CORTE = 202608;

const base = (nfCorrente: number) => [
  { "Ano Mes Ordem": 202610, Rubrica: "MDO", N3: "DIR A", N4: "AREA 1", BGQ1: 0, BGQ2: 0, BGQ3: 10000, Realizado_NF: 0, Futuro_NF_sem_operacional: nfCorrente },
];
const d05a = (ChaveUnica: string, CaixaPrevista: string, Status: string, Demanda: number) => ({ ChaveUnica, CaixaPrevista, Rubrica: "MDO", Status, Diretoria: "DIR A", Demanda });
const d05b = (ChaveTerceiros: string, CaixaPrevista: string, Realizado: number, Planejado_valido: number) => ({ ChaveTerceiros, CaixaPrevista, N4: "AREA 1", Realizado, Planejado_valido });
const run = (d02: unknown[], demandas: unknown[], nfs: unknown[], corte: number | null = CORTE) => consolidar(sustentacao(d02, demandas, CICLO, MES, nfs, corte));
const consumoMesCorrente = (c: ReturnType<typeof run>) => c.serie.find((x) => x.mes === MES)?.consumo;

describe("pendências de demanda 'A Pagar'", () => {
  it("T1: caixa anterior ao corte fica fora da conta", () => {
    const c = run(base(0), [d05a("T1", "2026-07-10", "A Pagar", 100)], []);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.pendenciaCorrente).toBe(0);
    expect(c.demandaFutura).toBe(0);
  });

  it("T2: caixa entre o corte e o mês corrente vira pendência vencida", () => {
    const c = run(base(0), [d05a("T2", "2026-08-15", "A Pagar", 200)], []);
    expect(c.pendenciaVencida).toBe(200);
    expect(c.pendenciaCorrente).toBe(0);
    expect(c.necessidade).toBe(200);
  });

  it("T3: linha com realizado ligado não gera pendência", () => {
    const c = run(base(0), [d05a("T3", "2026-09-10", "A Pagar", 300)], [d05b("T3", "2026-09-10", 300, 0)]);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.pendenciaCorrente).toBe(0);
  });

  it("T4: no mês corrente, a parte coberta pela NF não entra de novo", () => {
    const c = run(base(400), [d05a("T4", "2026-10-05", "A Pagar", 1000)], [d05b("T4", "2026-10-05", 0, 400)]);
    expect(c.emPagamento).toBe(400);
    expect(c.disponivel).toBe(9600);
    expect(c.pendenciaCorrente).toBe(600);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.resultado).toBe(9000);
    expect(consumoMesCorrente(c)).toBe(1000);
  });

  it("T5: linha 'Pago' só vai para pagoExcluido", () => {
    const c = run(base(0), [d05a("T5", "2026-11-10", "Pago", 500)], []);
    expect(c.pagoExcluido).toBe(500);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.pendenciaCorrente).toBe(0);
    expect(c.demandaFutura).toBe(0);
  });

  it("T6: sem corteDivida, não há pendências e o resultado é o de antes", () => {
    const c = run(base(400), [d05a("T2", "2026-08-15", "A Pagar", 200), d05a("T4", "2026-10-05", "A Pagar", 1000), d05a("T6F", "2026-12-10", "A Pagar", 700)], [d05b("T4", "2026-10-05", 0, 400)], null);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.pendenciaCorrente).toBe(0);
    expect(c.necessidade).toBe(c.demandaFutura);
    expect(c.resultado).toBe(c.disponivel - c.demandaFutura);
  });

  it("T7: resultado = disponível − (pendência vencida + pendência corrente + demanda futura)", () => {
    const c = run(base(400), [d05a("T2", "2026-08-15", "A Pagar", 200), d05a("T4", "2026-10-05", "A Pagar", 1000), d05a("T7F", "2026-12-10", "A Pagar", 700)], [d05b("T4", "2026-10-05", 0, 400)]);
    expect(c.resultado).toBe(c.disponivel - (c.pendenciaVencida + c.pendenciaCorrente + c.demandaFutura));
    expect(c.resultado).toBe(8100);
    expect(consumoMesCorrente(c)).toBe(1200);
  });

  it("T8: status 'Saldo' não gera pendência", () => {
    const c = run(base(0), [d05a("T8", "2026-09-10", "Saldo", 250)], []);
    expect(c.pendenciaVencida).toBe(0);
    expect(c.pendenciaCorrente).toBe(0);
  });
});
