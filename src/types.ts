export type Escopo = "MDO" | "RESERVAS";
export type Confianca = "Confirmado" | "Indício forte" | "Requer validação" | "Dado inconsistente" | "Simulação" | "Decisão pendente";

export interface Parametros {
  dataReferencia: string;
  mesCorrenteCaixa: number;
  horizonteMeses: number;
  janelaDemanda: { de: number; ate: number };
  janelaCustoPosition: { de: number; ate: number };
  limiarExcesso: number;
  correcoes: { rc: string; campo: string; valor: number; motivo: string }[];
  naoDecidido: { id: string; tema: string; efeito: string }[];
  decididos?: { id: string; decisao: string }[];
  ciclo: { de: number; ate: number };
}

export interface MesCaixa {
  mes: number; label: string; ano: number;
  bgq1: number; bgq3: number; realizado: number; futuro: number; compromisso: number;
  demandaCompetencia: number | null;
}

export interface Cobertura {
  escopo: Escopo;
  bgq3: number; bgq1: number; realizado: number; nfMesCorrente: number; nfFuturaTotal: number;
  saldoBG: number; saldoDemanda: number; orcamentoLivre: number;
  demandaMedia: number; mesesJanela: number; meses: number | null;
  rupturaMes: { mes: number; fracao: number } | null;
  necessidadeHorizonte: number; demandaSustentavel: number; reducaoNecessaria: number | null;
  custoPosition: number | null; positionsAtuais: number | null; positionsSustentaveis: number | null;
  comBGQ1: { saldo: number; meses: number | null; reducao: number | null };
  perda: number; perdaMeses: number | null; ultimoMesComBG: number | null;
  porAno: { ano: number; bgq1: number; bgq3: number; realizado: number; futuro: number; compromisso: number; saldo: number }[];
}

export interface PontoLinhaTempo {
  mes: number; label: string; saldoInicial: number; consumo: number; saldoFinal: number;
  status: "coberto" | "ruptura" | "deficit"; temBG: boolean; bgq3Mes: number; demandaCadastrada: number | null;
}

export interface Rc {
  idPPM: string; projeto: string; rc: string; oc: string; fornecedor: string; status: string; statusCompromisso: string;
  valida: boolean; pendente: boolean; planejado: number; empenho: number; realizado: number;
  nfRealizado: number; nfPlanejadaAberta: number; ultimaCompetenciaNF: string | null;
  aCancelar: number; naoEmitir: number; reRatear: number;
  sinal: string | null; saldoEmpenho: number | null; nfFuturaValida: number | null; nfDuplicadaExcluida: number;
}

export interface Mock {
  idPPM: string; mock: string; rc: string | null; status: string; fornecedorId: string; rubricaId: string;
  planejado: number; nfNoMock: number; emitidoMesmoProjForn: number; gemea: string | null; modificado: string | null;
  tipo: string; confianca: Confianca | null; valorDuplicado: number; leitura: string; rcFk: boolean;
}

export type Classe = "A" | "B" | "C" | "saldo" | "ok";

export interface Projeto {
  idPPM: string; projeto: string; bgq3: number; bgq3_2026: number; bgq3_2027: number;
  emitido: number; aEmitir: number; nvRealizado: number; comprometido: number;
  excesso: number; saldo: number; classe: Classe; categoria: string; causa: string; confianca: Confianca; decisao: string;
  explicadoForte: number; explicadoValidar: number; estouroReal: number; emitidoAcima: number;
  aCancelar: number; naoEmitir: number; reRatear: number; qtdRcs: number; fornecedores: number;
  responsavel: string | null; semCadastro: boolean;
}

export type Grupo = "Decidir agora" | "Solicitar validação" | "Delegar correção" | "Monitorar";

export interface ItemAgenda {
  id: string; grupo: Grupo; acao: string; impacto: number; qtd: number | null; unidade: string | null;
  justificativa: string; recomendacao: string; confianca: Confianca; evidencia: string; dependencia: string | null; inacao: string;
}

export interface ItemFila {
  tipo: string; idPPM: string; projeto: string; rc: string; fornecedor: string; valor: number; status: string;
  acao: string; prioridade: "Alta" | "Média" | "Baixa"; confianca: Confianca; responsavel: string | null; evidencia?: string;
}

export interface Fonte { id: string; arquivo: string; uso: string; linhas: number; atualizadoEm: string | null; presente: boolean }

export interface Bundle {
  meta: { geradoEm: string; dataReferencia: string; extracao: { data: string; extraidoEm: string; origem: string } | null; fontes: Fonte[]; avisos: string[];
    conferencia?: { ok: boolean; itens: { nome: string; ok: boolean; total: number; diferenca: number; mesesDivergentes: number[] }[] } };
  parametros: Parametros;
  correcoesAplicadas: { rc: string; campo: string; valor: number; motivo: string; de: number; IdPPM: string }[];
  cobertura: Record<Escopo, Cobertura>;
  caixa: Record<Escopo, MesCaixa[]>;
  linhaDoTempo: Record<Escopo, PontoLinhaTempo[]>;
  perdas: {
    rubricas: { rubrica: string; a2026: { bgq1: number; bgq3: number }; a2027: { bgq1: number; bgq3: number } }[];
    projetosMDO: { idPPM: string; projeto: string; bgq1_2026: number; bgq3_2026: number; bgq1_2027: number; bgq3_2027: number; perda: number }[];
  };
  projetos: Projeto[];
  rcs: Rc[];
  mocks: Mock[];
  agenda: ItemAgenda[];
  filas: ItemFila[];
  sustentacao: import("./lib/sustentacao").Sustentacao;
  areas: {
    orcamento: OrcArea[];
    projetos: { idPPM: string; projeto: string; n4: string; bgq3: number; pago: number; futuro: number }[];
    demanda: DemArea[];
    demandaPorProjeto: Record<string, number>;
  };
}

/** Orçamento por área financeira (N4) × rubrica × mês de caixa. */
export interface OrcArea { n4: string; n3: string; rub: string; mes: number; bgq1: number; bgq2: number; bgq3: number; pago: number; futuro: number }

/** Linha de demanda (competência ≥ mês corrente) já distribuída pela área que paga a NF. */
export interface DemArea {
  k: string; prof: string; comp: number; rub: string; st: string; g4: string; ger: string; gestor: string; forn: string;
  dem: number; nf: number; cob: "total" | "parcial" | "sem"; n4: string; v: number;
}
