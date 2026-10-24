// Gera public/data/bundle.json a partir dos CSVs exportados do Power BI.
// Uso: npm run data   (roda sozinho antes de "npm run build")
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, missingColumns } from "./lib/csv.mjs";
import { orcamentoPorArea, demandaPorArea } from "./lib/areas.mjs";
import { sustentacao, perfilAtribuicao } from "./lib/sustentacao.mjs";
import { conferir } from "./lib/conferencia.mjs";
import {
  addMes, caixaMensal, cobertura, linhaDoTempo, aplicarCorrecoes, montarRcs, classificarMocks,
  montarProjetos, perdas, agenda, filas,
} from "./lib/compute.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "public", "data");

export const FONTES = [
  { id: "R26", arquivo: "R26_caixa_mensal_rubrica", obrigatoria: true, uso: "Caixa mensal: BGQ1, BGQ3, realizado, NF futura e demanda", colunas: ["Ano Mes Ordem", "Rubrica", "BGQ1", "BGQ3", "Realizado_NF", "Futuro_NF_sem_operacional"] },
  { id: "R25", arquivo: "R25_demanda_competencia", obrigatoria: true, uso: "Demanda CAPEX por competência e rubrica", colunas: ["Ano Mes Ordem", "Rubrica", "Demanda_ativa", "Positions_com_valor"] },
  { id: "R02", arquivo: "R02_projetos_orcamento_rc", obrigatoria: true, uso: "BGQ3 por projeto", colunas: ["IdPPM", "NomeLB", "Orc_BGQ3_Total", "Orc_BGQ3_2026", "Orc_BGQ3_2027"] },
  { id: "R03", arquivo: "R03_rcs_detalhe", obrigatoria: true, uso: "RCs por projeto, com a marcação de RC válida", colunas: ["IdPPM", "NomeLB", "IdRequisicaoConecta", "StatusEmissao", "RC Valida", "NomeFornecedor", "RC_Planejado", "RC_Empenho", "RC_Realizado", "NF_Realizado", "NF_Futuro"] },
  { id: "R13", arquivo: "R13_saldo_por_rc", obrigatoria: true, uso: "Saldo de empenho por RC válida (sem a duplicata do merge)", colunas: ["IdPPM", "IdRequisicaoConecta", "NF_Futuro", "NF_Duplicada_Excluida", "Saldo_Empenho", "Sinal"] },
  { id: "R21", arquivo: "R21_mocks_a_emitir", obrigatoria: true, uso: "RCs a emitir, mocks e gêmeas", colunas: ["IdPPM", "IdRequisicaoFake", "IdRequisicaoConecta", "StatusEmissao", "Planejado_mock", "NF_no_mock", "Emitido_mesmo_proj_forn_rub", "Gemea_valor_igual"] },
  { id: "R22", arquivo: "R22_perdas_rubrica", obrigatoria: true, uso: "Perdas BGQ1 → BGQ3 por rubrica e ano", colunas: ["Rubrica", "Natureza", "Ano", "BGQ1", "BGQ3"] },
  { id: "R23", arquivo: "R23_perdas_projeto_mdo", obrigatoria: true, uso: "Perdas de MDO por projeto", colunas: ["IdPPM", "NomeLB", "Perda_total"] },
  { id: "D02", arquivo: "D02_caixa_area", obrigatoria: true, uso: "Orçamento e caixa por área financeira (N4), projeto, rubrica e mês", colunas: ["N4", "IdPPM", "Rubrica", "Ano Mes Ordem", "BGQ1", "BGQ2", "BGQ3", "Realizado_NF", "Futuro_NF_sem_operacional"] },
  { id: "D05a", arquivo: "D05a_demanda_linhas", obrigatoria: true, uso: "Demanda por profissional e competência, com gestor (alocação)", colunas: ["ChaveUnica", "Competencia", "Rubrica", "Status", "GestorN4", "Demanda"] },
  { id: "D05b", arquivo: "D05b_nf_rateio", obrigatoria: true, uso: "Rateio das NFs por projeto e área financeira (N4)", colunas: ["ChaveTerceiros", "N4", "Realizado", "Planejado_valido"] },
  { id: "D01", arquivo: "D01_responsaveis", obrigatoria: false, uso: "Responsável por projeto (PO / 1º Aprovador)", colunas: ["IdPPM", "PO", "Aprovador"] },
];

function lerFonte(f, avisos) {
  const file = path.join(dataDir, `${f.arquivo}.csv`);
  if (!fs.existsSync(file)) {
    if (f.obrigatoria) throw new Error(`Falta ${f.arquivo}.csv em public/data. Rode a consulta ${f.arquivo}.dax e salve o resultado.`);
    avisos.push(`${f.arquivo}.csv não encontrado: ${f.uso.toLowerCase()} aparece como "Não informado".`);
    return { rows: null, info: { ...f, linhas: 0, atualizadoEm: null, presente: false } };
  }
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const faltam = missingColumns(rows, f.colunas);
  if (faltam.length) throw new Error(`${f.arquivo}.csv sem as colunas: ${faltam.join(", ")}. Confira se a consulta ${f.arquivo}.dax é a versão do projeto.`);
  return { rows, info: { id: f.id, arquivo: f.arquivo, uso: f.uso, linhas: rows.length, atualizadoEm: fs.statSync(file).mtime.toISOString(), presente: true } };
}

export function resolverParametros(cfg, extracao, hoje = new Date()) {
  const ref = cfg.dataReferencia && cfg.dataReferencia !== "auto"
    ? cfg.dataReferencia
    : (extracao?.data ?? hoje.toISOString().slice(0, 10));
  const [y, m] = ref.split("-").map(Number);
  const mesCorrenteCaixa = y * 100 + m;
  const jan = (j) => ({ de: addMes(mesCorrenteCaixa, j.deslocamento), ate: addMes(mesCorrenteCaixa, j.deslocamento + j.meses - 1) });
  return {
    ...cfg,
    dataReferencia: ref,
    mesCorrenteCaixa,
    corteDivida: cfg.corteDivida ?? null,
    janelaDemanda: jan(cfg.janelaDemanda),
    janelaCustoPosition: jan(cfg.janelaCustoPosition),
  };
}

export function construir(dados, p) {
  const { rows: r03c, aplicadas } = aplicarCorrecoes(dados.R03, p.correcoes || []);
  const rcs = montarRcs(r03c, dados.R13);
  const mocks = classificarMocks(dados.R21, p);
  const corpoFilas = [];
  const projetos = montarProjetos(dados.R02, rcs, mocks, dados.D01, p);
  const cobMDO = cobertura(dados.R26, dados.R25, "MDO", p);
  const cobRes = cobertura(dados.R26, dados.R25, "RESERVAS", p);
  const serieMDO = caixaMensal(dados.R26, dados.R25, "MDO");
  const serieRes = caixaMensal(dados.R26, dados.R25, "RESERVAS");
  corpoFilas.push(...filas({ rcs, projetos, mocks }));
  return {
    parametros: p,
    correcoesAplicadas: aplicadas,
    cobertura: { MDO: cobMDO, RESERVAS: cobRes },
    caixa: { MDO: serieMDO, RESERVAS: serieRes },
    linhaDoTempo: { MDO: linhaDoTempo(cobMDO, serieMDO, p), RESERVAS: linhaDoTempo(cobRes, serieRes, p) },
    perdas: perdas(dados.R22, dados.R23),
    projetos,
    rcs,
    mocks: mocks.filter((m) => m.tipo),
    agenda: agenda({ rcs, projetos, mocks, cobMDO, cobRes, p }),
    filas: corpoFilas,
    sustentacao: { ...sustentacao(dados.D02, dados.D05a, p.ciclo, p.mesCorrenteCaixa, dados.D05b, p.corteDivida), atribuicao: perfilAtribuicao(dados.D05a, dados.D05b, p.ciclo, p.mesCorrenteCaixa) },
    areas: (() => {
      const orc = orcamentoPorArea(dados.D02);
      const dem = demandaPorArea(dados.D05a, dados.D05b, p.mesCorrenteCaixa);
      // filas de demanda sem cobertura de NF (uma linha por profissional × competência)
      const vistos = new Set();
      for (const r of dem.linhas) {
        if (r.cob === "total" || vistos.has(r.k)) continue;
        vistos.add(r.k);
        const falta = r.cob === "sem" ? r.dem : r.dem - r.nf;
        corpoFilas.push({
          tipo: r.cob === "sem" ? "Demanda sem rateio" : "Demanda com rateio parcial",
          idPPM: "", projeto: `${r.gestor || "Profissional " + r.prof} · ${r.ger}`, rc: `competência ${String(r.comp).slice(4)}/${String(r.comp).slice(2, 4)}`,
          fornecedor: r.forn, valor: falta, status: r.st,
          acao: r.cob === "sem" ? "Definir projeto/RC e planejar a NF" : "Completar o rateio da NF",
          prioridade: r.cob === "sem" ? "Alta" : "Média", confianca: "Confirmado", responsavel: r.g4,
          evidencia: `${r.rub} · demanda ${Math.round(r.dem).toLocaleString("pt-BR")} · NF ${Math.round(r.nf).toLocaleString("pt-BR")}`,
        });
      }
      return { orcamento: orc.linhas, projetos: orc.projetos, demanda: dem.linhas, demandaPorProjeto: dem.porProjeto };
    })(),
  };
}

function main() {
  const avisos = [];
  // O PowerShell 5 grava UTF-8 com BOM; o JSON.parse não aceita o BOM.
  const lerJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
  const cfg = lerJson(path.join(root, "config", "parametros.json"));
  const extFile = path.join(dataDir, "_extracao.json");
  const extracao = fs.existsSync(extFile) ? lerJson(extFile) : null;
  const p = resolverParametros(cfg, extracao);
  const dados = {}, fontes = [];
  for (const f of FONTES) {
    const { rows, info } = lerFonte(f, avisos);
    dados[f.id] = rows;
    fontes.push(info);
  }
  if (extracao?.manual) avisos.push("Dados exportados manualmente em momentos diferentes (ver Sobre os dados). Para prestar contas, rode scripts/atualizar-dados.ps1: uma extração única do modelo, com data e hora.");
  if (!extracao) avisos.push("Sem _extracao.json: data de referência = data do build. Use scripts/atualizar-dados.ps1 para extrair do Power BI.");
  const corpo = construir(dados, p);
  const conferencia = conferir(dados, p.ciclo);
  for (const c of conferencia.itens.filter((x) => !x.ok)) {
    avisos.unshift(`Conferência com o modelo falhou: ${c.nome} difere em ${c.diferenca.toFixed(2)} (meses ${c.mesesDivergentes.join(", ")}). Os números do painel não devem ser apresentados até corrigir.`);
  }
  const bundle = {
    meta: { geradoEm: new Date().toISOString(), dataReferencia: p.dataReferencia, extracao, fontes, avisos, conferencia },
    ...corpo,
  };
  fs.writeFileSync(path.join(dataDir, "bundle.json"), JSON.stringify(bundle));
  console.log(`  conferência com o modelo: ${conferencia.ok ? "OK" : "FALHOU"} (${conferencia.itens.map((x) => `${x.nome} ${x.ok ? "ok" : "≠"}`).join(" · ")})`);
  if (!conferencia.ok && process.env.BGR_ESTRITO === "1") {
    console.error("Conferência falhou em modo estrito: interrompendo.");
    process.exit(2);
  }
  const c = corpo.cobertura;
  console.log(`bundle.json gerado (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB) · referência ${p.dataReferencia}`);
  console.log(`  Reservas: BGQ3 ${(c.RESERVAS.bgq3 / 1e6).toFixed(2)} mi · realizado ${(c.RESERVAS.realizado / 1e6).toFixed(2)} mi · orçamento livre ${(c.RESERVAS.orcamentoLivre / 1e6).toFixed(2)} mi`);
  console.log(`  MDO: saldo p/ demanda ${(c.MDO.saldoDemanda / 1e6).toFixed(2)} mi · demanda média ${(c.MDO.demandaMedia / 1e6).toFixed(2)} mi/mês · ${c.MDO.meses?.toFixed(1)} meses`);
  const acima = corpo.projetos.filter((x) => ["A", "B", "C"].includes(x.classe));
  console.log(`  Projetos acima do BGQ3: ${acima.length} · excesso ${(acima.reduce((a, x) => a + x.excesso, 0) / 1e6).toFixed(2)} mi`);
  for (const a of avisos) console.log(`  aviso: ${a}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`\nERRO ao gerar os dados: ${e.message}\n`); process.exit(1); }
}
