# BG de Reservas: proposta v2 da Home gerencial

08/10/2026 · padrão visual em [docs/padroes/home-gerencial-narrativa](padroes/home-gerencial-narrativa/pattern.md) · wireframe em `wireframe-home.png`

## 0. Achado que bloqueia a Home atual (regra 1)

Revisei a conta da Home publicada ("Até fev/27, faltam R$ 788 mil"). Ela **não pode ser apresentada como conclusão**. Os fatos abaixo saem das próprias extrações DAX:

| # | Fato | Fonte |
|---|---|---|
| F1 | O BGQ3 vai até o caixa de **mar/27** (R$ 4,24 mi em mar/27). Não há BG em abr/27. | R26 |
| F2 | A demanda vai até a competência fev/27. O caixa previsto fica 0 a 2 meses depois da competência (62 / 582 / 556 linhas). Por isso a demanda chega ao caixa de **abr/27**, mês sem BG (R$ 0,80 mi de NF futura em abr/27). | D05a, R26 |
| F3 | A Home atual desconta do BG só a NF de out/26. A regra 6 do time ("Saldo = BG − realizado − NF futura") desconta **toda** a NF futura. Pela regra 6, BGQ3 − realizado − NF futura dá **+R$ 0,94 mi**. A Home atual mostra −R$ 788 mil. As duas fórmulas chegam a sinais opostos. | D02 |
| F4 | A demanda de competência set/26 (caixa em nov/26) não entra na demanda e também não é descontada do saldo. | D05a |
| F5 | R$ 0,78 mi de linhas com status "Pago" têm caixa a partir de nov/26 e são contadas como demanda futura. | D05a |
| F6 | A Home atual distribui a demanda pelas áreas na proporção da NF. Isso é uma **inferência** e deve ser trocado pelo valor exato da NF por área, mais um balde "sem NF". | método atual |

**Consequência:** até que V01–V03 rodem e OQ-H1/OQ-H2 sejam decididas, o Bloco 1 mostra "aguarda validação" no lugar do número.

## 1. Nova arquitetura da navegação

```
Visão gerencial ── Situação → Problema → Solução
   │  clique numa área em "Onde falta" / "Onde sobra"
   ▼
Projetos e emissão (já filtrada pela área) ── projetos impactados, ranking
   │  clique no projeto → painel lateral: fornecedor → RC → NF
   ▼
Execução e qualidade (já filtrada pelo projeto) ── auditoria: RC, NF, rateio, duplicidade, mock
   │
   └─ Chip "Dados de dd/mm" → Sobre os dados (consultas, regras, pendências)
```

São as mesmas 3 abas. Muda o papel da primeira e a passagem de filtro de uma camada para a seguinte.

## 2. Wireframe da Home

Veja `wireframe-home.png`. Os blocos:

1. **Situação.** Uma frase com estado 🔴/🟢. O 🟡 só entra quando o time definir o que é "baixa margem" (OQ-H3).
2. **Como chegamos.** Fluxo Orçamento disponível − Demanda futura = Resultado. À direita, a consequência: cobertura, horizonte do BG e demanda sem área.
3. **Onde sobra / Onde falta.** Duas listas com barra, sem matriz e sem tabela, com alternador Área | Rubrica. "Sem área (sem NF)" aparece como item da lista de faltas.
4. **Podemos resolver?** Sobras, faltas e o resultado depois de remanejar, terminando numa frase de decisão. Fica bloqueado até a regra de remanejamento (OQ-R1).

## 3. Componentes que permanecem

- **Tela 2:** ranking de projetos, barra de composição (duplicidade / mock / estouro / sem BGQ3), painel lateral fornecedor → RC → NF, etiquetas de ação, ações rápidas.
- **Tela 3:** 3 pilares, os 11 tipos de pendência, painel lateral do item, "Exportar registro".
- **Geral:** chip de status dos dados e "Sobre os dados".
- **Filtros globais:** rubrica, área, responsável, cenário.

## 4. Componentes que mudam

| Hoje | Proposta |
|---|---|
| Frase com número calculado por fórmula não validada | `ConclusaoSituacao` mostrando "aguarda validação" até V01–V03 |
| Régua de 4 KPIs soltos | `FluxoConclusao` (causa → consequência) + trilho à direita |
| Matriz área × rubrica | 2 listas (sobra / falta) com alternador |
| Tabela "O que mudou BGQ1→BGQ3" | Sai da Home e vai para "Sobre os dados" ou para a tela 2 |
| "Decisões propostas" calculadas na tela | `CartaoRemanejamento`, bloqueado até OQ-R1 |
| Distribuição proporcional da demanda por área | Valor exato da NF por área + "sem NF" |

## 5. Ajustes na tela Projetos e emissão (sem mudar a lógica)

- Recebe o filtro de área e rubrica vindo da Home e mostra a origem: "Filtrado por: Captação · vindo da Visão gerencial".
- Tipografia: projeto 15px semibold, valor 16px bold, área e ação 13px. Linhas com 14px de padding vertical.
- Filtros fixos no topo ao rolar. Opção "Agrupar por área" que cria um cabeçalho por N4 com subtotal; o ranking continua dentro do grupo.
- Nada sai: ranking, painel lateral e investigação continuam iguais.

## 6. Ajustes na tela Execução e qualidade (sem mudar a lógica)

- Os 11 tipos passam de um dropdown escondido para **chips visíveis** abaixo do pilar ativo, cada um com contagem.
- Recebe o filtro de projeto vindo da tela 2.
- Menos ruído: a etiqueta de confiança só aparece no painel lateral; a coluna "Responsável" fica atenuada quando o modelo não informa.

## 7. Nova hierarquia visual

1. Conclusão: 22px bold, cor de estado.
2. Números do fluxo: 28px.
3. Títulos dos cartões: 17px.
4. Itens das listas: 14px semibold, valor com sinal.
5. Labels: 11px em caixa alta, atenuados.

Cor só para estado (verde = sobra, vermelho = falta, âmbar = pendente de validação). Os filtros ficam em uma única linha no topo.

## 8. Justificativa de UX

- A pergunta da reunião ("a demanda cabe?") vira a primeira frase. A pergunta antiga ("por que o número não bate?") vira a terceira camada, sem perder nada.
- O fluxo mostra causa e consequência, e não 4 KPIs que o leitor precisa somar de cabeça.
- Listas com sinal e barra se leem em menos de 10 segundos. A matriz exigia cruzar linha e coluna.
- O estado "aguarda validação" torna visível a regra de prestação de contas: a tela nunca mostra um número que o time não sabe defender.

## 9. Consultas para o DAX Studio

Arquivos em `consultas/validacao/`, cada um com um único EVALUATE (compatível com `atualizar-dados.ps1`):

| Consulta | Valida | Decide |
|---|---|---|
| **V01** `V01_demanda_x_nf_por_mes_caixa.dax` | Demanda × NF vinculada por mês de caixa, rubrica e status: demanda sem NF e demanda acima da NF | OQ-H1 (descontar NF futura do BG ou contar a demanda inteira) e o valor "sem área" |
| **V02** `V02_nf_futura_por_area_e_vinculo.dax` | NF futura por mês de caixa, área e vínculo com a demanda (com linha, sem linha, em Saldo, sem profissional) | Áreas de "Onde sobra/falta" sem distribuição proporcional; NF em mês sem BG (OQ-H2) |
| **V03** `V03_demanda_paga_em_competencia_futura.dax` | Linhas "Pago" com caixa a partir de out/26 e o realizado de cada uma | Se os R$ 0,78 mi saem da demanda futura (F5) |

## Open Questions (decisão do time, não do painel)

- **OQ-H1:** Orçamento disponível = BG − realizado − **toda** a NF futura (regra 6) ou só a NF do mês corrente (Home atual)?
- **OQ-H2:** Horizonte da comparação: caixa até o último mês com BG (hoje mar/27) ou competência? O que fazer com a NF em abr/27, mês sem BG?
- **OQ-H3:** O que é "baixa margem" (estado 🟡)? Sem definição, a Home mostra só 🔴/🟢.
- **OQ-H4:** Fórmula da cobertura em meses: saldo ÷ demanda média de quais meses? (as fórmulas de KPI ainda não estão definidas no CLAUDE.md)
- **OQ-R1:** Remanejamento: entre áreas N4? entre rubricas? quem aprova? Sem essa regra, o Bloco 4 mostra só sobras e faltas, sem "depois de remanejar".

---

## Atualização 08/10/2026 (noite): decisões aplicadas na Home

| Questão | Decisão | Como a Home aplica |
|---|---|---|
| OQ-H1 | BG aprovado − realizado − valores já em pagamento | NF do mês corrente = em pagamento. A NF dos meses seguintes não é descontada. |
| OQ-H2 | Ciclo abr/26 → mar/27 | NF depois de mar/27 aparece como "fora do orçamento vigente" e fica fora da conta. |
| OQ-H3 | Só 🟢 Coberto / 🔴 Não coberto | Sem amarelo. |
| OQ-H4 | Cobertura sobre o orçamento total do ciclo | Meses do ciclo em que o consumo acumulado (realizado → mês corrente → demanda) cabe no BG. |
| OQ-R1 | Primeiro sobra e falta, depois oportunidade | A Home sinaliza a oportunidade, avisa que a sobra pode não estar livre e não calcula "depois de remanejar". |

**V03 respondida com dados já extraídos.** As 36 linhas "Pago" com caixa em nov/26 (competência set/26) somam R$ 777.350 e têm NF realizada exatamente igual (D05b, pagas no caixa de out/26). Por isso saem da demanda futura. A consulta V03 fica no repositório para reconferência.

**Ainda aguardando validação:** visão por área (N4) e filtro de responsável. Dependem de V01, V02 e da regra OQ-A1 (como atribuir à área a demanda de um profissional rateado entre áreas).

## Atualização 09/10/2026: OQ-A1 decidida e diretoria

- **OQ-A1:** a área (N4) da demanda é a área do projeto da RC que paga o profissional. Quando ele é pago por várias RCs de áreas diferentes (50 linhas, R$ 1,26 mi), cada RC leva a sua parte, na proporção do valor da NF. Demanda sem NF (R$ 1,18 mi) fica em "Sem área".
- **Diretoria (N3):** orçamento por dN4[N3]; demanda pela Diretoria da lista de terceiros (ligada a aux_n3). Em 100% da demanda com NF (R$ 10,53 mi) as duas coincidem.
- V01 e V02 passam a ser consultas de reconferência, não mais bloqueio.

## Atualização 09/10/2026: OQ-R1 (remanejamento)

- Remanejamento entre rubricas, diretorias e áreas só como **estudo simulado**, nunca por padrão. Quem aprova: **o diretor**.
- O card "Possível solução" abre um simulador de plano: sugestão automática (cobre cada falta com a maior sobra), movimentos editáveis, efeito em resultado e meses sustentados por item, alerta quando a sobra usada já está comprometida com NF depois do ciclo, exportação em CSV e e-mail para aprovação do diretor.
- O resultado total da operação não muda na simulação: remanejar não cria orçamento.
