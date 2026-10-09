// Regras de negócio do painel "BG de Reservas – decisão".
// Fonte das regras: auditoria/Respostas_Negocio_BG_Reservas.md (regras confirmadas em 08/10/2026).
// Todas as funções são puras: recebem linhas dos CSVs + parâmetros e devolvem dados prontos para a tela.

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const s = (v) => (v === null || v === undefined ? "" : String(v).trim());
const sum = (arr, f) => arr.reduce((a, x) => a + n(f(x)), 0);
const RESERVAS = ["MDO", "INSTALAÇÃO", "RESERVA"];
const PENDENTE = new Set(["A EMITIR", "AGUARDANDO CONECTA"]);

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const labelMes = (ym) => `${MESES[(ym % 100) - 1]}/${String(Math.floor(ym / 100)).slice(2)}`;
export const addMes = (ym, k) => {
  const y = Math.floor(ym / 100), m = (ym % 100) - 1 + k;
  return (y + Math.floor(m / 12)) * 100 + (((m % 12) + 12) % 12) + 1;
};
const mesesEntre = (de, ate) => { const out = []; for (let m = de; m <= ate; m = addMes(m, 1)) out.push(m); return out; };

/* ------------------------------------------------------------------ */
/* Caixa mensal (R26) e cobertura da demanda (R25)                     */
/* ------------------------------------------------------------------ */

/** Série mensal por escopo (MDO ou RESERVAS = MDO + INSTALAÇÃO + RESERVA). */
export function caixaMensal(r26, r25, escopo) {
  const rubs = escopo === "MDO" ? ["MDO"] : RESERVAS;
  const meses = [...new Set(r26.map((r) => r["Ano Mes Ordem"]))].sort((a, b) => a - b);
  const dem = new Map();
  for (const r of r25) {
    if (!rubs.includes(r.Rubrica)) continue;
    dem.set(r["Ano Mes Ordem"], (dem.get(r["Ano Mes Ordem"]) || 0) + n(r.Demanda_ativa));
  }
  return meses.map((m) => {
    const rows = r26.filter((r) => r["Ano Mes Ordem"] === m && rubs.includes(r.Rubrica));
    const realizado = sum(rows, (r) => r.Realizado_NF);
    const futuro = sum(rows, (r) => r.Futuro_NF_sem_operacional);
    return {
      mes: m,
      label: labelMes(m),
      ano: Math.floor(m / 100),
      bgq1: sum(rows, (r) => r.BGQ1),
      bgq3: sum(rows, (r) => r.BGQ3),
      realizado,
      futuro,
      compromisso: realizado + futuro,
      demandaCompetencia: dem.get(m) ?? null,
    };
  });
}

/**
 * Cobertura (regra 5/6): saldo = BG total − realizado acumulado − NF já planejada no mês corrente;
 * meses cobertos = saldo ÷ demanda média mensal (CAPEX, status ≠ Saldo) da janela de competência.
 */
export function cobertura(r26, r25, escopo, p) {
  const serie = caixaMensal(r26, r25, escopo);
  const rubs = escopo === "MDO" ? ["MDO"] : RESERVAS;
  const bgq3 = sum(serie, (x) => x.bgq3);
  const bgq1 = sum(serie, (x) => x.bgq1);
  const realizado = sum(serie.filter((x) => x.mes <= p.mesCorrenteCaixa), (x) => x.realizado);
  const nfMesCorrente = sum(serie.filter((x) => x.mes === p.mesCorrenteCaixa), (x) => x.futuro);
  const nfFuturaTotal = sum(serie, (x) => x.futuro);
  const janela = mesesEntre(p.janelaDemanda.de, p.janelaDemanda.ate);
  const demJanela = r25.filter((r) => rubs.includes(r.Rubrica) && janela.includes(r["Ano Mes Ordem"]));
  const demandaMedia = sum(demJanela, (r) => r.Demanda_ativa) / janela.length;

  const saldoBG = bgq3 - realizado;
  const saldoDemanda = saldoBG - nfMesCorrente;
  const meses = demandaMedia > 0 ? saldoDemanda / demandaMedia : null;
  const h = p.horizonteMeses;
  const saldoQ1 = bgq1 - realizado - nfMesCorrente;

  // custo médio por position (MDO): demanda ÷ positions na janela de referência
  const jc = mesesEntre(p.janelaCustoPosition.de, p.janelaCustoPosition.ate);
  const base = r25.filter((r) => r.Rubrica === "MDO" && jc.includes(r["Ano Mes Ordem"]));
  const custoPosition = sum(base, (r) => r.Positions_com_valor) > 0
    ? sum(base, (r) => r.Demanda_ativa) / sum(base, (r) => r.Positions_com_valor)
    : null;

  const porAno = [2026, 2027].map((ano) => {
    const x = serie.filter((m) => m.ano === ano);
    const bg = sum(x, (m) => m.bgq3);
    const comp = sum(x, (m) => m.compromisso);
    return { ano, bgq1: sum(x, (m) => m.bgq1), bgq3: bg, realizado: sum(x, (m) => m.realizado), futuro: sum(x, (m) => m.futuro), compromisso: comp, saldo: bg - comp };
  });

  return {
    escopo,
    bgq3, bgq1, realizado, nfMesCorrente, nfFuturaTotal,
    saldoBG, saldoDemanda,
    orcamentoLivre: bgq3 - realizado - nfFuturaTotal,
    demandaMedia,
    mesesJanela: janela.length,
    meses,
    rupturaMes: meses === null ? null : rupturaDe(p.mesCorrenteCaixa, meses),
    necessidadeHorizonte: demandaMedia * h,
    demandaSustentavel: saldoDemanda / h,
    reducaoNecessaria: demandaMedia > 0 ? Math.max(0, 1 - saldoDemanda / (demandaMedia * h)) : null,
    custoPosition,
    positionsAtuais: custoPosition ? demandaMedia / custoPosition : null,
    positionsSustentaveis: custoPosition ? saldoDemanda / h / custoPosition : null,
    comBGQ1: {
      saldo: saldoQ1,
      meses: demandaMedia > 0 ? saldoQ1 / demandaMedia : null,
      reducao: demandaMedia > 0 ? Math.max(0, 1 - saldoQ1 / (demandaMedia * h)) : null,
    },
    perda: bgq1 - bgq3,
    perdaMeses: demandaMedia > 0 ? (bgq1 - bgq3) / demandaMedia : null,
    ultimoMesComBG: [...serie].reverse().find((m) => m.bgq3 > 0)?.mes ?? null,
    porAno,
  };
}

/** Mês (aaaamm) e fração em que o saldo acaba, contando a partir do 1º dia do mês corrente. */
export function rupturaDe(mesInicial, meses) {
  if (meses === null || !Number.isFinite(meses)) return null;
  const k = Math.floor(Math.max(0, meses));
  return { mes: addMes(mesInicial, k), fracao: Math.max(0, meses) - k };
}

/** Linha do tempo do horizonte: saldo inicial consumido pela demanda média (estimativa). */
export function linhaDoTempo(cob, serie, p, opts = {}) {
  const reducao = opts.reducao ?? 0;
  const reforco = opts.reforco ?? 0;
  const h = opts.horizonte ?? p.horizonteMeses;
  const consumo = cob.demandaMedia * (1 - reducao);
  let saldo = cob.saldoDemanda + reforco;
  const bgPorMes = new Map(serie.map((m) => [m.mes, m]));
  const out = [];
  for (let i = 0; i < h; i++) {
    const mes = addMes(p.mesCorrenteCaixa, i);
    const ini = saldo;
    saldo = ini - consumo;
    const m = bgPorMes.get(mes);
    out.push({
      mes, label: labelMes(mes),
      saldoInicial: ini, consumo, saldoFinal: saldo,
      status: saldo >= 0 ? "coberto" : ini > 0 ? "ruptura" : "deficit",
      temBG: !!(m && m.bgq3 > 0),
      bgq3Mes: m ? m.bgq3 : 0,
      demandaCadastrada: m ? m.demandaCompetencia : null,
    });
  }
  return out;
}

/** Simulação: mesma regra da cobertura com premissas alteradas (não altera o modelo). */
export function simular(cob, p, { reducao = 0, reforco = 0, horizonte = p.horizonteMeses } = {}) {
  const consumo = cob.demandaMedia * (1 - reducao);
  const saldo = cob.saldoDemanda + reforco;
  const meses = consumo > 0 ? saldo / consumo : null;
  const saldoFinal = saldo - consumo * horizonte;
  return {
    consumo, saldo, meses,
    ruptura: meses === null ? null : meses >= horizonte - 1e-6 ? null : rupturaDe(p.mesCorrenteCaixa, meses),
    saldoFinal,
    deficit: Math.max(0, -saldoFinal),
    demandaSustentavel: saldo / horizonte,
    reducaoNecessaria: cob.demandaMedia > 0 ? Math.max(0, 1 - saldo / (cob.demandaMedia * horizonte)) : null,
    positionsSustentaveis: cob.custoPosition ? saldo / horizonte / cob.custoPosition : null,
  };
}

/* ------------------------------------------------------------------ */
/* RCs (R03 + R13) e mocks (R21)                                       */
/* ------------------------------------------------------------------ */

export function aplicarCorrecoes(r03, correcoes) {
  const aplicadas = [];
  const rows = r03.map((r) => {
    const c = correcoes.find((x) => x.rc === s(r.IdRequisicaoConecta));
    if (!c || n(r[c.campo]) === c.valor) return r;
    aplicadas.push({ ...c, de: n(r[c.campo]), IdPPM: s(r.IdPPM) });
    return { ...r, [c.campo]: c.valor };
  });
  return { rows, aplicadas };
}

/** Uma linha por RC × projeto, com a leitura de negócio já aplicada. */
export function montarRcs(r03, r13) {
  const r13ByKey = new Map(r13.map((r) => [`${s(r.IdPPM)}|${s(r.IdRequisicaoConecta)}`, r]));
  return r03.map((r) => {
    const valida = s(r["RC Valida"]) === "Valida";
    const status = s(r.StatusEmissao);
    const pendente = PENDENTE.has(status);
    const planejado = n(r.RC_Planejado), empenho = n(r.RC_Empenho), realizado = n(r.RC_Realizado);
    const nfRealizado = n(r.NF_Realizado), nfTotal = n(r.NF_Futuro); // R03: NF_Futuro = NF total (realizado ou planejado)
    const r13r = r13ByKey.get(`${s(r.IdPPM)}|${s(r.IdRequisicaoConecta)}`);
    const rc = s(r.IdRequisicaoConecta);
    return {
      idPPM: s(r.IdPPM),
      projeto: s(r.NomeLB),
      rc: rc || "(sem número)",
      oc: s(r.IdOrdemConecta),
      fornecedor: s(r.NomeFornecedor) || "(sem fornecedor)",
      status,
      statusCompromisso: s(r.StatusCompromisso),
      valida, pendente,
      planejado, empenho, realizado,
      nfRealizado,
      nfPlanejadaAberta: Math.max(0, nfTotal - nfRealizado),
      ultimaCompetenciaNF: r.Ult_Comp_NF || null,
      // RC a cancelar (NaoEhValida = TRUE, já emitida): saldo empenhado ainda não realizado
      aCancelar: !valida && !pendente ? Math.max(0, empenho - realizado) : 0,
      // RC não válida que ainda não foi emitida: não emitir
      naoEmitir: !valida && pendente ? planejado : 0,
      // NF planejada sobre RC a cancelar: re-ratear em RC válida
      reRatear: !valida ? Math.max(0, nfTotal - nfRealizado) : 0,
      sinal: r13r ? s(r13r.Sinal) : null,
      saldoEmpenho: r13r ? n(r13r.Saldo_Empenho) : null,
      nfFuturaValida: r13r ? n(r13r.NF_Futuro) : null,
      nfDuplicadaExcluida: r13r ? n(r13r.NF_Duplicada_Excluida) : 0,
    };
  });
}

/**
 * Explicação do excesso por mock/duplicidade (R21), com grau de confiança.
 * Indício forte: gêmea com mesmo valor, mesmo ID mock com RC real, mock = RC aguardando de mesmo valor,
 *                RC já emitida no mesmo projeto/fornecedor/rubrica cobrindo o mock.
 * Requer validação: mock = 2× o rateio de NF (OQ-N16) → conta só a metade excedente.
 */
export function classificarMocks(r21, p) {
  const porProj = new Map();
  for (const r of r21) {
    const k = s(r.IdPPM);
    if (!porProj.has(k)) porProj.set(k, []);
    porProj.get(k).push(r);
  }
  const out = [];
  for (const [idPPM, rows] of porProj) {
    const usados = new Set();
    rows.forEach((r, i) => {
      const pl = n(r.Planejado_mock), nf = n(r.NF_no_mock), emit = n(r.Emitido_mesmo_proj_forn_rub);
      const fk = s(r.IdRequisicaoFake), status = s(r.StatusEmissao);
      let tipo = "", conf = "", valor = 0, leitura = "";
      const par = status === "A EMITIR"
        ? rows.findIndex((o, j) => j !== i && !usados.has(j) && s(o.StatusEmissao) === "AGUARDANDO CONECTA" && Math.abs(n(o.Planejado_mock) - pl) <= 1)
        : -1;
      if (s(r.Gemea_valor_igual)) {
        tipo = "gemea"; conf = "Indício forte"; valor = pl;
        leitura = `RC aguardando igual à RC ${s(r.Gemea_valor_igual)} já emitida`;
      } else if (fk && status === "A EMITIR" && rows.some((o, j) => j !== i && s(o.IdRequisicaoFake) === fk && s(o.IdRequisicaoConecta))) {
        tipo = "mesmo_id"; conf = "Indício forte"; valor = pl;
        leitura = `Mock ${fk} já tem RC real em outra linha: linha remanescente`;
      } else if (par >= 0) {
        usados.add(par);
        tipo = "mock_igual_aguardando"; conf = "Indício forte"; valor = pl;
        leitura = `Mock com o mesmo valor de RC aguardando Conecta (${s(rows[par].IdRequisicaoConecta)})`;
      } else if (pl > 0 && emit >= pl - 1) {
        tipo = "emitido_igual"; conf = "Indício forte"; valor = pl;
        leitura = "Já existe RC emitida no mesmo projeto, fornecedor e rubrica cobrindo o valor";
      } else if (nf > 0 && Math.abs(pl - 2 * nf) <= p.toleranciaDobroNF * pl) {
        tipo = "dobro_nf"; conf = "Requer validação"; valor = pl - nf;
        leitura = "Planejado = 2× o rateio de NF (OQ-N16)";
      }
      out.push({
        idPPM, mock: fk || "(sem ID mock)", rc: s(r.IdRequisicaoConecta) || null,
        status, fornecedorId: s(r.IdFornecedor), rubricaId: s(r.IdRubrica),
        planejado: pl, nfNoMock: nf, emitidoMesmoProjForn: emit,
        gemea: s(r.Gemea_valor_igual) || null, modificado: r.Modificado || null,
        tipo, confianca: conf || null, valorDuplicado: valor, leitura,
        rcFk: fk.startsWith("RC-FK-"),
      });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Projetos: BGQ3 como teto (R02 + RCs)                                */
/* ------------------------------------------------------------------ */

export function montarProjetos(r02, rcs, mocks, responsaveis, p) {
  const ids = new Set([...r02.map((r) => s(r.IdPPM)), ...rcs.map((r) => r.idPPM)]);
  const r02By = new Map(r02.map((r) => [s(r.IdPPM), r]));
  const respBy = new Map((responsaveis || []).map((r) => [s(r.IdPPM), r]));
  const out = [];
  for (const id of ids) {
    if (!id) continue;
    const b = r02By.get(id);
    const meus = rcs.filter((r) => r.idPPM === id);
    const val = meus.filter((r) => r.valida);
    const bgq3 = b ? n(b.Orc_BGQ3_Total) : 0;
    // Regra da P1: compromisso = planejado das RCs válidas + realizado das RCs a cancelar
    const emitido = sum(val.filter((r) => !r.pendente), (r) => r.planejado);
    const aEmitir = sum(val.filter((r) => r.pendente), (r) => r.planejado);
    const nvRealizado = sum(meus.filter((r) => !r.valida), (r) => r.realizado);
    const comprometido = emitido + aEmitir + nvRealizado;
    const excesso = comprometido - bgq3;
    const acima = excesso > p.limiarExcesso;
    let classe = "ok";
    if (acima) classe = bgq3 === 0 ? "C" : emitido + nvRealizado > bgq3 + p.limiarExcesso ? "B" : "A";
    else if (bgq3 > 0 && -excesso > p.limiarExcesso) classe = "saldo";

    const ms = mocks.filter((m) => m.idPPM === id);
    const forte = sum(ms.filter((m) => m.confianca === "Indício forte"), (m) => m.valorDuplicado);
    const validar = sum(ms.filter((m) => m.confianca === "Requer validação"), (m) => m.valorDuplicado);
    const exc = Math.max(0, excesso);
    const explForte = acima && classe !== "C" ? Math.min(exc, forte) : 0;
    const explValidar = acima && classe !== "C" ? Math.min(exc - explForte, validar) : 0;
    const estouroReal = acima && classe !== "C" ? exc - explForte - explValidar : 0;
    const emitidoAcima = classe === "B" ? emitido + nvRealizado - bgq3 : 0;

    const resp = respBy.get(id);
    const responsavel = resp ? s(resp.PO) || s(resp.Aprovador) || null : null;
    let { categoria, causa, confianca, decisao } = leituraProjeto({ classe, exc, explForte, explValidar, estouroReal, emitidoAcima, aEmitir });
    const suspeitas = val.filter((r) => r.empenho > 0 && r.planejado >= 10 * r.empenho);
    if (acima && suspeitas.length) {
      confianca = "Dado inconsistente";
      causa = `${causa}. Atenção: ${suspeitas.map((r) => r.rc).join(", ")} tem planejado ≥ 10× o empenho (possível erro de digitação)`;
      decisao = "Corrigir o cadastro da RC na origem antes de decidir";
    }

    out.push({
      idPPM: id,
      projeto: (b && s(b.NomeLB)) || meus[0]?.projeto || id,
      bgq3, bgq3_2026: b ? n(b.Orc_BGQ3_2026) : 0, bgq3_2027: b ? n(b.Orc_BGQ3_2027) : 0,
      emitido, aEmitir, nvRealizado, comprometido,
      excesso: exc, saldo: classe === "saldo" ? -excesso : 0,
      classe, categoria, causa, confianca, decisao,
      explicadoForte: explForte, explicadoValidar: explValidar, estouroReal, emitidoAcima,
      aCancelar: sum(meus, (r) => r.aCancelar),
      naoEmitir: sum(meus, (r) => r.naoEmitir),
      reRatear: sum(meus, (r) => r.reRatear),
      qtdRcs: meus.length,
      fornecedores: [...new Set(meus.map((r) => r.fornecedor))].length,
      responsavel,
      semCadastro: !b,
    });
  }
  return out.sort((a, b) => b.excesso - a.excesso || b.aCancelar - a.aCancelar);
}

export function leituraProjeto({ classe, exc, explForte, explValidar, estouroReal, emitidoAcima, aEmitir }) {
  if (classe === "C") return {
    categoria: "Sem BGQ3", causa: "Compromisso em projeto sem orçamento BGQ3 (contingenciamento não confirmado)",
    confianca: "Requer validação", decisao: "Confirmar contingenciamento ou orçamento; não emitir o valor pendente",
  };
  if (classe === "B") return {
    categoria: "Emitido acima do BGQ3", causa: `Valor já emitido supera o teto em ${brl(emitidoAcima)}`,
    confianca: "Confirmado", decisao: aEmitir > 0 ? "Bloquear novas emissões e avaliar regularização" : "Avaliar regularização do valor emitido",
  };
  if (classe === "A") {
    if (explForte >= 0.5 * exc) return {
      categoria: "Possível duplicidade", causa: "Mock de RC não baixado após a emissão da RC real",
      confianca: "Indício forte", decisao: "Baixar os mocks duplicados e recalcular o excesso",
    };
    if (explForte + explValidar >= 0.5 * exc) return {
      categoria: "Mock não baixado", causa: "Planejado do mock = 2× o rateio de NF (planejamento em dobro?)",
      confianca: "Requer validação", decisao: "Validar o planejamento do mock antes de cortar orçamento",
    };
    return {
      categoria: "Estouro real", causa: `Valor a emitir excede o teto em ${brl(estouroReal)} sem duplicidade identificada`,
      confianca: "Indício forte", decisao: "Não emitir acima do teto ou aprovar reforço orçamentário",
    };
  }
  if (classe === "saldo") return { categoria: "Saldo disponível", causa: "BGQ3 maior que o comprometido", confianca: "Confirmado", decisao: "Avaliar uso ou devolução do saldo" };
  return { categoria: "Dentro do teto", causa: "", confianca: "Confirmado", decisao: "" };
}

function brl(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}
export { brl };

/* ------------------------------------------------------------------ */
/* Perdas BGQ1 → BGQ3 (R22, R23)                                       */
/* ------------------------------------------------------------------ */

export function perdas(r22, r23) {
  const capex = r22.filter((r) => s(r.Natureza) === "CAPEX" && RESERVAS.includes(s(r.Rubrica)));
  const rubricas = RESERVAS.map((rub) => {
    const x = capex.filter((r) => s(r.Rubrica) === rub);
    const ano = (a) => {
      const y = x.filter((r) => r.Ano === a);
      return { bgq1: sum(y, (r) => r.BGQ1), bgq3: sum(y, (r) => r.BGQ3) };
    };
    return { rubrica: rub, a2026: ano(2026), a2027: ano(2027) };
  });
  const projetos = r23.map((r) => ({
    idPPM: s(r.IdPPM), projeto: s(r.NomeLB),
    bgq1_2026: n(r.BGQ1_2026), bgq3_2026: n(r.BGQ3_2026), bgq1_2027: n(r.BGQ1_2027), bgq3_2027: n(r.BGQ3_2027),
    perda: n(r.Perda_total),
  })).sort((a, b) => b.perda - a.perda);
  return { rubricas, projetosMDO: projetos };
}

/* ------------------------------------------------------------------ */
/* Agenda de decisões e filas operacionais                             */
/* ------------------------------------------------------------------ */

export function agenda({ rcs, projetos, mocks, cobMDO, cobRes, p }) {
  const nvCancel = rcs.filter((r) => r.aCancelar > 0);
  const nvAguard = rcs.filter((r) => r.naoEmitir > 0);
  const reRat = rcs.filter((r) => r.reRatear > 0);
  const acimaEmp = rcs.filter((r) => r.valida && r.sinal === "NFs acima do empenho");
  const semNF = rcs.filter((r) => r.valida && r.sinal === "Saldo sem NF futura");
  const A = projetos.filter((x) => x.classe === "A"), B = projetos.filter((x) => x.classe === "B"), C = projetos.filter((x) => x.classe === "C");
  const real = projetos.filter((x) => x.estouroReal > p.limiarExcesso);
  const mForte = mocks.filter((m) => m.confianca === "Indício forte");
  const mValidar = mocks.filter((m) => m.confianca === "Requer validação");
  const projForte = projetos.filter((x) => x.explicadoForte > 0);
  const projValidar = projetos.filter((x) => x.explicadoValidar > 0);
  const necessidade = cobMDO.demandaMedia * p.horizonteMeses - cobMDO.saldoDemanda;
  const rup = cobMDO.rupturaMes ? labelMes(cobMDO.rupturaMes.mes) : "—";

  const itens = [
    {
      id: "reforco-ou-reducao", grupo: "Decidir agora", acao: "Decidir entre reforço de orçamento e redução da demanda de MDO",
      impacto: necessidade, qtd: null, unidade: null,
      justificativa: `O saldo de MDO cobre ~${fmt1(cobMDO.meses)} meses da demanda atual; a ruptura estimada é em ${rup}.`,
      recomendacao: `Para atravessar ${p.horizonteMeses} meses sem reforço, a demanda precisa cair ~${pct(cobMDO.reducaoNecessaria)} (proposta para discussão, não regra).`,
      confianca: "Simulação", evidencia: "risco", dependencia: "Horizonte da cobertura (OQ-N15)",
      inacao: `Sem decisão, a demanda de MDO fica sem orçamento a partir de ${rup}.`,
    },
    {
      id: "cancelar-nv", grupo: "Decidir agora", acao: "Cancelar o saldo das RCs a cancelar no Conecta",
      impacto: sum(nvCancel, (r) => r.aCancelar), qtd: new Set(nvCancel.map((r) => r.rc)).size, unidade: "RCs",
      justificativa: "RCs já emitidas marcadas como não válidas (estouro do BGQ3 ou contingenciamento) ainda têm saldo empenhado.",
      recomendacao: "Solicitar o cancelamento do saldo em aberto; o realizado já pago permanece.",
      confianca: "Confirmado", evidencia: "fila:cancelar", dependencia: null,
      inacao: "O valor continua empenhado acima do teto e pode receber NF.",
    },
    {
      id: "bloquear-real", grupo: "Decidir agora", acao: "Bloquear emissões acima do teto sem duplicidade identificada",
      impacto: sum(real, (x) => x.estouroReal) + sum(B, (x) => Math.min(x.aEmitir, x.excesso)), qtd: new Set([...real, ...B].map((x) => x.idPPM)).size, unidade: "projetos",
      justificativa: "Depois de descontar mocks e duplicidades, estes projetos ainda ultrapassam o BGQ3 com o valor a emitir.",
      recomendacao: "Não emitir o excedente ou aprovar reforço específico por projeto.",
      confianca: "Indício forte", evidencia: "projetos:real", dependencia: null,
      inacao: "Emissão acima do teto do BGQ3.",
    },
    {
      id: "nao-emitir-nv", grupo: "Decidir agora", acao: "Não emitir RCs não válidas que aguardam o Conecta",
      impacto: sum(nvAguard, (r) => r.naoEmitir), qtd: new Set(nvAguard.map((r) => r.rc)).size, unidade: "RCs",
      justificativa: "Estão marcadas como não válidas, mas ainda seguem no fluxo de emissão.",
      recomendacao: "Retirar do fluxo de emissão.",
      confianca: "Confirmado", evidencia: "fila:nao-emitir", dependencia: null,
      inacao: "Novo empenho acima do teto.",
    },
    {
      id: "validar-c", grupo: "Solicitar validação", acao: "Confirmar contingenciamento dos projetos sem BGQ3",
      impacto: sum(C, (x) => x.excesso), qtd: C.length, unidade: "projetos",
      justificativa: "Há compromisso em projetos com BGQ3 igual a zero.",
      recomendacao: "Confirmar se estão contingenciados (marcar RCs como não válidas) ou se falta orçamento.",
      confianca: "Requer validação", evidencia: "projetos:C", dependencia: "OQ-N13",
      inacao: "Compromisso sem orçamento aprovado.",
    },
    {
      id: "validar-dobro", grupo: "Solicitar validação", acao: "Validar mocks planejados em dobro (2× o rateio de NF)",
      impacto: sum(projValidar, (x) => x.explicadoValidar), qtd: mValidar.length, unidade: "mocks",
      justificativa: "O planejado do mock é o dobro do rateio de NF: pode ser planejamento duplicado ou NF rateada pela metade.",
      recomendacao: "Confirmar com quem gera os mocks antes de cortar orçamento.",
      confianca: "Requer validação", evidencia: "fila:dobro", dependencia: "OQ-N16",
      inacao: "Corte de orçamento baseado em excesso que pode não existir.",
    },
    {
      id: "validar-saldo-sem-nf", grupo: "Solicitar validação", acao: "Revisar RCs válidas com saldo e sem NF futura",
      impacto: sum(semNF, (r) => r.saldoEmpenho), qtd: semNF.length, unidade: "RCs",
      justificativa: "Empenho sem rateio previsto: candidatas a cancelamento.",
      recomendacao: "Confirmar se o saldo será usado; senão, marcar como não válida.",
      confianca: "Requer validação", evidencia: "fila:saldo-sem-nf", dependencia: null,
      inacao: "Orçamento travado em RC sem uso previsto.",
    },
    {
      id: "baixar-mocks", grupo: "Delegar correção", acao: "Baixar mocks duplicados na lista de RCs",
      impacto: sum(projForte, (x) => x.explicadoForte), qtd: mForte.length, unidade: "mocks",
      justificativa: "O mock não foi substituído quando a RC real foi emitida; o planejamento fica em dobro.",
      recomendacao: "Substituir o ID mock pela RC real na ListaRCsConsolidada.",
      confianca: "Indício forte", evidencia: "fila:mocks", dependencia: null,
      inacao: "Excesso aparente sobre o BGQ3 e decisões de corte erradas.",
    },
    {
      id: "re-ratear", grupo: "Delegar correção", acao: "Re-ratear NFs planejadas em RCs a cancelar",
      impacto: sum(reRat, (r) => r.reRatear), qtd: reRat.length, unidade: "RCs",
      justificativa: "RC não válida não pode receber rateio de NF.",
      recomendacao: "Mover o rateio para uma RC válida do mesmo projeto.",
      confianca: "Confirmado", evidencia: "fila:re-ratear", dependencia: null,
      inacao: "Pagamento sobre RC que será cancelada.",
    },
    {
      id: "nf-acima-empenho", grupo: "Delegar correção", acao: "Ajustar RCs com NFs acima do empenho",
      impacto: -sum(acimaEmp, (r) => r.saldoEmpenho), qtd: acimaEmp.length, unidade: "RCs",
      justificativa: "O rateio de NF supera o valor empenhado na RC.",
      recomendacao: "Aditivo dentro do BGQ3 ou re-rateio.",
      confianca: "Confirmado", evidencia: "fila:acima-empenho", dependencia: null,
      inacao: "NF sem cobertura de empenho no Conecta.",
    },
    {
      id: "deficit-2027", grupo: "Monitorar", acao: "Acompanhar o déficit de 2027 já planejado",
      impacto: -Math.min(0, cobRes.porAno.find((a) => a.ano === 2027)?.saldo ?? 0), qtd: null, unidade: null,
      justificativa: "Em 2027 o compromisso já planejado supera o BGQ3 do ano.",
      recomendacao: "Reprogramar caixa ou buscar orçamento de 2027 no próximo BG.",
      confianca: "Confirmado", evidencia: "risco", dependencia: null,
      inacao: "Falta de caixa em 2027 mesmo sem nova demanda.",
    },
  ];
  return itens.filter((i) => i.impacto > 1 || i.id === "reforco-ou-reducao");
}

const fmt1 = (v) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const pct = (v) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export function filas({ rcs, projetos, mocks }) {
  const projBy = new Map(projetos.map((x) => [x.idPPM, x]));
  const base = (r, tipo, valor, acao, prioridade, confianca) => ({
    tipo, idPPM: r.idPPM, projeto: r.projeto, rc: r.rc, fornecedor: r.fornecedor, valor,
    status: r.status, acao, prioridade, confianca, responsavel: projBy.get(r.idPPM)?.responsavel ?? null,
  });
  const out = [];
  for (const r of rcs) {
    if (r.aCancelar > 0) out.push(base(r, "RC a cancelar", r.aCancelar, "Cancelar saldo em aberto no Conecta", "Alta", "Confirmado"));
    if (r.naoEmitir > 0) out.push(base(r, "RC que não deve ser emitida", r.naoEmitir, "Retirar do fluxo de emissão", "Alta", "Confirmado"));
    if (r.reRatear > 0) out.push(base(r, "NF para re-rateio", r.reRatear, "Re-ratear NF em RC válida", "Média", "Confirmado"));
    if (r.valida && r.sinal === "NFs acima do empenho") out.push(base(r, "NF acima do empenho", -n(r.saldoEmpenho), "Aditivo dentro do BGQ3 ou re-rateio", "Média", "Confirmado"));
    if (r.valida && r.sinal === "Saldo sem NF futura") out.push(base(r, "Item aguardando validação", n(r.saldoEmpenho), "Confirmar uso do saldo ou cancelar", "Baixa", "Requer validação"));
    if (r.valida && r.empenho > 0 && r.planejado >= 10 * r.empenho) out.push({ ...base(r, "Dado cadastral a corrigir", r.planejado - r.empenho, "Conferir o valor planejado na ListaRCsConsolidada (planejado ≥ 10× o empenho)", "Alta", "Dado inconsistente"), evidencia: `planejado ${Math.round(r.planejado).toLocaleString("pt-BR")} × empenho ${Math.round(r.empenho).toLocaleString("pt-BR")}` });
    if (r.nfDuplicadaExcluida > 0) out.push(base(r, "Possível duplicidade de NF", r.nfDuplicadaExcluida, "Planejado sem match com o realizado (já excluído do compromisso)", "Baixa", "Confirmado"));
  }
  for (const m of mocks) {
    if (!m.tipo) continue;
    const pj = projBy.get(m.idPPM);
    out.push({
      tipo: m.confianca === "Indício forte" ? "Mock a baixar" : "Possível duplicidade de planejamento",
      idPPM: m.idPPM, projeto: pj?.projeto ?? m.idPPM, rc: m.rc ? `${m.mock} → ${m.rc}` : m.mock,
      fornecedor: `Fornecedor ${m.fornecedorId}`, valor: m.valorDuplicado, status: m.status,
      acao: m.confianca === "Indício forte" ? "Substituir o mock pela RC real" : "Validar planejamento (OQ-N16)",
      prioridade: m.confianca === "Indício forte" ? "Média" : "Baixa", confianca: m.confianca, responsavel: pj?.responsavel ?? null,
      evidencia: m.leitura,
    });
  }
  for (const x of projetos.filter((x) => x.classe === "C")) {
    out.push({ tipo: "Projeto sem BGQ3", idPPM: x.idPPM, projeto: x.projeto, rc: "—", fornecedor: "—", valor: x.excesso, status: "—",
      acao: "Confirmar contingenciamento ou orçamento", prioridade: "Alta", confianca: "Requer validação", responsavel: x.responsavel });
  }
  for (const x of projetos.filter((x) => x.semCadastro)) {
    out.push({ tipo: "Dado cadastral a corrigir", idPPM: x.idPPM, projeto: x.projeto, rc: "—", fornecedor: "—", valor: x.comprometido, status: "—",
      acao: "Projeto com RCs sem linha de orçamento na consulta de projetos", prioridade: "Baixa", confianca: "Dado inconsistente", responsavel: null });
  }
  return out;
}
