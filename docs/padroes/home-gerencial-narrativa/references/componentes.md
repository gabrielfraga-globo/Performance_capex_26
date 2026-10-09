# Componentes do padrão (aplicados ao BG de Reservas)

| Componente | Referência Monex | Equivalente BG de Reservas | Fonte do dado |
|---|---|---|---|
| `ConclusaoSituacao` | aviso "Expecting deficit…" promovido ao topo | frase de 2 linhas, estado 🔴/🟡/🟢 | resultado do fluxo; o limiar 🟡 depende de OQ-H3 |
| `FluxoConclusao` | coluna de totais | Orçamento disponível − Demanda futura = Resultado | D02 + V01 (fórmula: OQ-H1) |
| `TrilhoConsequencia` | totais com chip | Cobertura · horizonte · demanda sem área | V02 (horizonte: OQ-H2) |
| `ListaSaldoDeficit` (×2) | cartão Overview/Analysis | Onde sobra / Onde falta, com alternador Área \| Rubrica | D02 por N4/rubrica + V01/V02 |
| `CartaoRemanejamento` | cartão Forecast + aviso | Sobras, faltas, depois de remanejar, decisão | regra de remanejamento: OQ-R1 |
| `ChipStatusDados` | ícone de notificação | data da extração e acesso a "Sobre os dados" | `_extracao.json` |

Regras de exibição:

- **Valor não validado:** `<Pendente consulta="V01" />` no lugar do número. Nunca zero, nunca estimativa.
- **Item da lista:** nome → barra proporcional ao maior item do mesmo cartão → valor com sinal. No máximo 5 itens e um link "ver todos" que leva à tela 2 já filtrada.
- **Decisão:** frase imperativa de até 20 palavras, montada só a partir dos números do próprio cartão.
