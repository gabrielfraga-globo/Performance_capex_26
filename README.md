# Performance CAPEX 26 · BG de Reservas – Decisão

Painel executivo para a diretoria responder, a partir do modelo **[SM] Acompanhamento Mensal Caixa**:
estamos dentro do BGQ3? Quanto ainda podemos comprometer? Quanto tempo o orçamento sustenta a demanda?
Quanto do estouro é real? O que precisa ser decidido agora?

Mesmo padrão do `capex-dashboard-react`: **consultas DAX → CSV → script `.mjs` → JSON → app React estático (Vercel)**.

## Telas

| Tela | Pergunta | Nível |
|---|---|---|
| Resumo do Diretor | Estamos financeiramente saudáveis? | Executivo |
| Risco e Sustentabilidade | O que acontece se nada for feito? | Executivo |
| Projetos Críticos | Quais projetos exigem minha atenção? (drill Projeto → Fornecedor → RC → NF) | Gerencial |
| Agenda de Decisões | O que decidir ou cobrar do time? | Gerencial |
| Simulador | Qual combinação de ações torna o portfólio sustentável? | Executivo |
| Central Operacional | Fila de trabalho do time (exporta CSV) | Operacional |

## Atualização diária dos dados

### Automática (recomendado)
Com o PBIP aberto no Power BI Desktop:

```powershell
.\scripts\atualizar-dados.ps1              # extrai os CSVs e gera bundle.json
.\scripts\atualizar-dados.ps1 -Build       # + build local
.\scripts\atualizar-dados.ps1 -Publicar    # + commit/push (deploy automático no Vercel via Git)
.\scripts\atualizar-dados.ps1 -Publicar -VercelCli   # publica com "vercel --prod"
```

O script encontra o Desktop aberto (porta local do Analysis Services), roda cada `public/data/*.dax`, grava o `.csv`
ao lado no formato do DAX Query View (`;` e decimal `,`) e carimba `public/data/_extracao.json`. Essa data vira a
**data de referência**: o mês corrente, a janela da demanda e o custo por position são recalculados a partir dela.

### Manual
1. Abra cada `public/data/*.dax` no DAX Query View e rode.
2. Exporte o resultado com o mesmo nome do arquivo (`R26_caixa_mensal_rubrica.csv`, …) em `public/data`.
3. Rode `npm run data` (ou `npm run build`).

Se faltar uma consulta ou coluna, o build para com uma mensagem clara, em vez de publicar número errado.

## Consultas

| Arquivo | Uso |
|---|---|
| `R26_caixa_mensal_rubrica` | Caixa mensal por rubrica: BGQ1, BGQ3, realizado, NF futura válida |
| `R25_demanda_competencia` | Demanda CAPEX ativa por competência e rubrica, positions |
| `R02_projetos_orcamento_rc` | BGQ3 por projeto |
| `R03_rcs_detalhe` | RCs por projeto com a marcação de RC válida |
| `R13_saldo_por_rc` | Saldo de empenho por RC válida, sem a duplicata do merge |
| `R21_mocks_a_emitir` | RCs a emitir, mocks e gêmeas |
| `R22_perdas_rubrica` · `R23_perdas_projeto_mdo` | Perdas BGQ1 → BGQ3 |
| `D01_responsaveis` (opcional) | PO / 1º Aprovador por projeto |

São as consultas validadas nas rodadas de auditoria de 07–08/10/2026. Os anos 2026 e 2027 são o escopo do ciclo do BG.

## Regras aplicadas

Fonte: `auditoria/Respostas_Negocio_BG_Reservas.md` (projeto Gestão de Reservas).

1. O BGQ3 é o teto e não pode ser ultrapassado.
2. Reservas = MDO + Instalação + Reserva, natureza CAPEX.
3. Compromisso = realizado, quando houver; senão, planejado. O planejado "Não encontrado" do merge sai; o realizado fica.
4. RC não válida = RC emitida a cancelar; não recebe NF.
5. Mock não baixado duplica o planejado.
6. BG = orçamento total desde jan/26, incluindo o realizado. Saldo = BG − realizado − NF futura válida.
7. Demanda = lista de terceiros, origem CAPEX, status ≠ Saldo.

**Classes de projeto acima do teto:** A = excesso só no valor a emitir; B = emitido já acima do BGQ3; C = sem BGQ3.

**Explicação do excesso (R21):**
- **Indício forte:** gêmea com o mesmo valor; mesmo ID mock já com RC real; mock com o mesmo valor de RC aguardando; RC emitida no mesmo projeto, fornecedor e rubrica cobrindo o mock.
- **Requer validação:** mock = 2× o rateio de NF (OQ-N16).
- **Estouro real:** o que sobra.

Parâmetros em `config/parametros.json`: horizonte, janelas, tolerâncias, correções confirmadas (ex.: erro ×100 da RCGRJ10680852) e a lista "não decidido".

## Desenvolvimento

```bash
npm install
npm run dev        # gera bundle.json e abre o Vite
npm test           # regressão das regras contra os números validados
npm run build      # prebuild (bundle.json) + tsc + vite build → dist/
```

## Deploy no Vercel

- Framework: Vite · Build: `npm run build` · Output: `dist` (já em `vercel.json`).
- Os CSVs ficam versionados em `public/data`; o Vercel regenera o `bundle.json` no build.
- O painel é estático: qualquer pessoa com o link vê os dados. Use proteção por senha ou SSO do Vercel se necessário.

## Limites conhecidos

- O modelo não liga NF à natureza; as NFs de positions OPERACIONAL são excluídas pela lista de terceiros.
- O BGQ1 de 2027 está concentrado em mar/27: compare BGQ1 × BGQ3 só no total anual.
- Status de ação, prazo e "acompanhar execução" exigem gravação (write-back): Power Apps, lista SharePoint ou a plataforma Gestão de Terceiros.
- Reprogramação de caixa não está no simulador (falta a regra de deslocamento de NFs).

## Atualizar os dados (sem API do Power BI)

O painel lê o mesmo modelo semântico do BI, aberto no **Power BI Desktop**: o Desktop roda um Analysis Services local e o script consulta esse serviço pela porta local, sem passar pela API do Power BI Service.

1. Abra o PBIP `[SM] Acompanhamento Mensal Caixa` no Power BI Desktop e clique em **Atualizar** (traz SharePoint e banco do dia).
2. Dê dois cliques em **`atualizar.cmd`** (ou `atualizar-e-publicar.cmd` para já publicar na Vercel).

O script:
- encontra sozinho o modelo aberto (porta local);
- roda as 11 consultas `public/data/*.dax` com as medidas do próprio modelo e grava os CSVs (`;` e decimal `,`);
- grava `public/data/_extracao.json` com data e hora (vira a data de referência do painel);
- **confere a fidelidade**: as consultas abertas (D02 por área/projeto e D05a por profissional) precisam fechar mês a mês com a consulta agregada R26. Se não fecharem, nada é gerado nem publicado;
- gera o site (`npm run build`) e, no modo publicar, roda `vercel --prod`.

Se o PowerShell estiver bloqueado na máquina, o caminho manual continua válido: rode cada `.dax` de `public/data` no DAX Query View ou DAX Studio e salve o CSV com o mesmo nome. A conferência roda igual no `npm run build`.
