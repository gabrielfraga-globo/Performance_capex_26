# Padrão: Home gerencial narrativa (conclusão → causa → onde → decisão)

Extraído da referência "Financial analytics" (Monex). O padrão é a **estrutura narrativa**, não o visual escuro nem os dados da imagem. Componentes detalhados: [references/componentes.md](references/componentes.md). Wireframe aplicado ao BG de Reservas: [wireframe-home.html](wireframe-home.html).

## 1. Leitura visual da referência

- **Estrutura:** topbar (marca · navegação principal · conta) → título da página com seletores de período à direita → sub-abas da análise → zona "herói" (gráfico grande + coluna de totais) → faixa de 3 cartões de leitura.
- **Hierarquia:** 1º os totais grandes da coluna direita; 2º o mês destacado no gráfico com tooltip; 3º os três cartões de baixo; 4º o aviso de previsão ("Expecting deficit in May…").
- **Densidade:** baixa. Cerca de 10 números na tela inteira e nenhuma tabela.
- **Tom:** financeiro e sóbrio. A cor só aparece em categoria (receita/despesa) e em variação (+/−).

## 2. Componentes detectados

| Componente | Posição | Papel |
|---|---|---|
| Navegação principal (4 itens, 1 ativo em pílula) | topo, centro | troca de módulo |
| Seletores de escopo (contas, granularidade, ano) | linha do título, direita | definem o recorte da página inteira |
| Sub-abas (Summary, Balance…) | sob o título | aprofundamento dentro do mesmo módulo |
| Gráfico de barras divergentes por mês | herói, 2/3 da largura | entrada × saída no tempo |
| Tooltip fixo no mês em foco | sobre o gráfico | detalhe sem sair da tela |
| Coluna de totais com chip de variação | herói, 1/3 direito | 3 números da conclusão |
| Cartão "Overview" (valor + barra de composição + 3 partes) | base, 1/3 | de onde vem o total |
| Cartão "Analysis" (donut + legenda com %) | base, 1/3 | para onde vai o total |
| Cartão "Forecast" (linhas + aviso em texto) | base, 1/3 | o que vai acontecer e o que fazer |
| Aviso de insight (ícone + 1 frase) | rodapé do cartão de previsão | conclusão acionável |

## 3. Layout

- Grade de 12 colunas. Herói em 8 + 4; base em 4 + 4 + 4.
- Leitura em Z: título → totais à direita → gráfico → cartões de baixo da esquerda para a direita.
- Os cartões de baixo seguem a sequência **composição → destino → consequência**.

## 4. Cor, tipografia e espaçamento

- **Cor:** neutros de fundo; uma cor por categoria; verde e vermelho só em variação ou estado. Nenhuma cor é decorativa.
- **Escala tipográfica:**
  - título da página ~32px regular;
  - total ~28px semibold;
  - valor de cartão ~36px;
  - label 13px em cor atenuada;
  - legenda 12px.
- **Espaçamento:** generoso. Gutter de ~16px entre cartões e padding interno de ~24px. O respiro em volta dos números é intencional.

## 5. Receitas

- **Total com variação:** label → valor → chip de variação à direita. O chip só existe quando há base de comparação real.
- **Cartão de composição:** valor total → barra empilhada → até 3 partes (nome, valor, %).
- **Cartão de conclusão:** um gráfico pequeno, mais uma frase de ação no rodapé.
- **Filtros:** todos no topo e de escopo global. Nenhum filtro dentro de cartão; o cartão tem no máximo um alternador de agrupamento.

## 6. Estados

- **Carregando:** esqueleto dos 3 totais e dos 3 cartões.
- **Vazio:** frase "Sem dados para o recorte" e o filtro que esvaziou a tela.
- **Erro / dado não validado:** o número **não aparece**. O espaço mostra "aguarda validação" e o nome da consulta pendente (regra de prestação de contas).
- **Parcial:** o rótulo informa o horizonte efetivamente coberto.

## 7. Responsividade e acessibilidade

- Abaixo de 1024px, o herói empilha (totais primeiro) e os cartões viram uma coluna.
- Contraste AA. Sinal (+/−) e palavra ("sobra"/"falta") sempre acompanham a cor.
- Os gráficos têm `aria-label` com os valores. Alvos de toque têm no mínimo 40px.

## 8. Camada visual × camada de dados

| Fixo no padrão | Variável (dados) |
|---|---|
| Ordem conclusão → causa → onde → decisão | Texto da conclusão e estado (🔴/🟡/🟢) |
| Herói 8 + 4, base 4 + 4 + 4 | Valores do fluxo, das listas e da decisão |
| Cor só por estado | Itens das listas (áreas, rubricas) |
| Aviso de ação no último cartão | Ação recomendada |

## 9. Conexão com dados

O padrão não decide a fonte. Neste projeto, todo número vem de consulta DAX ao modelo semântico, exportada em CSV, transformada em JSON e servida ao React. Uma API ou um banco podem substituir o CSV no futuro sem mudar o padrão. Regra do projeto: **nenhum placeholder vira número sem a consulta de validação correspondente.**

## 10. Prompt de reuso

```
Crie uma Home gerencial seguindo docs/padroes/home-gerencial-narrativa/pattern.md:
- Bloco 1: conclusão em até 2 linhas com estado 🔴/🟡/🟢
- Bloco 2: fluxo [recurso] − [consumo] = [resultado] → [consequência], com 3 totais à direita
- Bloco 3: dois cartões "Onde sobra" / "Onde falta" (lista com barra, sem tabela)
- Bloco 4: cartão "Podemos resolver?" terminando numa frase de decisão
- Filtros só no topo; cor só para estado
- Todo valor vem de [fonte]; sem consulta validada, mostrar "aguarda validação"
```
