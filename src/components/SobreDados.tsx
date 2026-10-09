import { useApp } from "../App";
import { Drawer } from "./ui";
import { brl, dataBR, mes } from "../lib/format";

export default function SobreDados({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { b } = useApp();
  const p = b.parametros;
  return (
    <Drawer open={open} onClose={onClose} title="Sobre os dados" width={680}>
      <div className="space-y-6 text-[13px]">
        <section>
          <h4 className="font-bold mb-1">Data de referência</h4>
          <p className="text-ink-muted">
            {dataBR(b.meta.dataReferencia)} · mês corrente de caixa {mes(p.mesCorrenteCaixa)} · demanda média da competência {mes(p.janelaDemanda.de)}–{mes(p.janelaDemanda.ate)} ·
            horizonte de {p.horizonteMeses} meses. {b.meta.extracao ? `Origem: ${b.meta.extracao.origem}.` : ""} Gerado em {new Date(b.meta.geradoEm).toLocaleString("pt-BR")}.
          </p>
        </section>

        <section>
          <h4 className="font-bold mb-2">Como a Visão gerencial calcula (ciclo {mes(p.ciclo.de)} → {mes(p.ciclo.ate)})</h4>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Orçamento disponível = BG do ciclo − realizado no Conecta até {mes(p.mesCorrenteCaixa)} − NF em pagamento em {mes(p.mesCorrenteCaixa)}. A NF dos meses seguintes não é descontada.</li>
            <li>Demanda futura = lista de terceiros (CAPEX, status A Pagar) com caixa previsto depois de {mes(p.mesCorrenteCaixa)} até {mes(p.ciclo.ate)}. Linhas "Pago" ficam fora: a NF delas já está no realizado.</li>
            <li>Sustentação = meses do ciclo, a partir de {mes(p.ciclo.de)}, em que o consumo acumulado (realizado, mês corrente, demanda) cabe no BG do ciclo.</li>
            <li>NF depois de {mes(p.ciclo.ate)} aparece como "fora do orçamento vigente" e não entra na conta.</li>
            <li>Diretoria (N3): orçamento por dN4[N3] e demanda pela diretoria da lista de terceiros (ligadas por aux_n3 no modelo). Em 100% da demanda com NF as duas coincidem.</li>
            <li>Área (N4): orçamento pelo N4 do projeto (dN4); demanda pela área do projeto da RC que paga o profissional. Pago por várias RCs: cada RC leva a sua parte, na proporção do valor da NF. Sem NF = "Sem área". Filtro de responsável: aguardando regra.</li>
            <li>Ações rápidas (Aprovar, Notificar, Descartar) ficam salvas só neste navegador até existir a camada de banco; use "Exportar registro" na tela 3.</li>
          </ul>
        </section>

        {p.decididos && (
          <section>
            <h4 className="font-bold mb-2">Decisões do time (08/10/2026)</h4>
            <ul className="space-y-1 text-ink-muted">{p.decididos.map((d) => <li key={d.id}><b className="text-ink">{d.id}</b> {d.decisao}</li>)}</ul>
          </section>
        )}

        <section>
          <h4 className="font-bold mb-2">Regras aplicadas (confirmadas pelo time em 08/10/2026)</h4>
          <ol className="list-decimal pl-5 space-y-1 text-ink-muted">
            <li>O BGQ3 é o teto orçamentário e não pode ser ultrapassado.</li>
            <li>Reservas = rubricas MDO, Instalação e Reserva (Solução fora), natureza CAPEX.</li>
            <li>Compromisso = realizado, quando houver; senão, planejado. O planejado das NFs "Não encontrado" é duplicata do merge e sai; o realizado dessas linhas fica.</li>
            <li>RC não válida (NaoEhValida) = RC já emitida a cancelar. Não recebe rateio de NF.</li>
            <li>Mock (RC-FK-… ou ID provisório) precisa ser substituído pela RC real; até lá o planejamento pode ficar em dobro.</li>
            <li>BG = orçamento total de caixa desde jan/26, incluindo o realizado. Saldo = BG − realizado − NF futura válida.</li>
            <li>Demanda financeira = lista de terceiros com origem CAPEX, rubricas MDO/Instalação/Reserva, status diferente de Saldo.</li>
          </ol>
        </section>

        <section>
          <h4 className="font-bold mb-2">Não decidido · o painel não conclui</h4>
          <table className="tbl">
            <thead><tr><th>Pendência</th><th>Efeito no painel</th></tr></thead>
            <tbody>{p.naoDecidido.map((o) => <tr key={o.id}><td><b>{o.id}</b> {o.tema}</td><td className="text-ink-muted">{o.efeito}</td></tr>)}</tbody>
          </table>
        </section>

        {b.correcoesAplicadas.length > 0 && (
          <section>
            <h4 className="font-bold mb-2">Correções aplicadas na leitura</h4>
            <ul className="space-y-1 text-ink-muted">
              {b.correcoesAplicadas.map((c) => <li key={c.rc}><b>{c.rc}</b> ({c.IdPPM}): {c.campo} {brl(c.de)} → {brl(c.valor)}. {c.motivo}</li>)}
            </ul>
          </section>
        )}

        {b.meta.conferencia && (
          <section>
            <h4 className="font-bold mb-2">Conferência com o modelo {b.meta.conferencia.ok ? "· OK" : "· FALHOU"}</h4>
            <p className="text-ink-muted mb-2">As consultas abertas por área e profissional (D02, D05a) precisam fechar, mês a mês, com a consulta agregada R26, que usa as medidas do BI.</p>
            <table className="tbl">
              <thead><tr><th>Conferência</th><th className="num">Total no ciclo</th><th className="num">Diferença</th></tr></thead>
              <tbody>{b.meta.conferencia.itens.map((c) => <tr key={c.nome}><td>{c.ok ? "✓" : "✗"} {c.nome}</td><td className="num">{brl(c.total)}</td><td className={`num ${c.ok ? "" : "text-crit"}`}>{c.ok ? "—" : brl(c.diferenca)}</td></tr>)}</tbody>
            </table>
          </section>
        )}

        <section>
          <h4 className="font-bold mb-2">Consultas DAX (public/data)</h4>
          <table className="tbl">
            <thead><tr><th>Consulta</th><th>Uso</th><th className="num">Linhas</th></tr></thead>
            <tbody>
              {b.meta.fontes.map((f) => (
                <tr key={f.id}><td className="tabular">{f.arquivo}</td><td className="text-ink-muted">{f.uso}</td><td className="num">{f.presente ? f.linhas : "ausente"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        {b.meta.avisos.length > 0 && (
          <section>
            <h4 className="font-bold mb-1">Avisos</h4>
            <ul className="list-disc pl-5 text-warn">{b.meta.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
        )}

        <section>
          <h4 className="font-bold mb-1">Limites conhecidos</h4>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>O modelo não liga NF à natureza: as NFs de positions OPERACIONAL são excluídas pela lista de terceiros.</li>
            <li>O BGQ1 de 2027 está concentrado em mar/27: compare BGQ1 × BGQ3 só no total anual.</li>
            <li>Responsável e status de ação não existem no modelo; prazo não é inventado.</li>
          </ul>
        </section>
      </div>
    </Drawer>
  );
}
