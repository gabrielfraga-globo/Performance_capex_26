import { useCallback, useEffect, useState } from "react";

/**
 * Registro das ações rápidas (Aprovar / Descartar / Notificar).
 * PROTÓTIPO: fica salvo só neste navegador (localStorage). Não é compartilhado nem auditável
 * até existir a camada de banco (fase 2). Por isso a tela permite exportar o registro em CSV.
 */
export type StatusDecisao = "aprovado" | "descartado" | "notificado";
export interface Decisao { chave: string; titulo: string; valor: number; status: StatusDecisao; em: string }

const KEY = "bgr-decisoes-v1";
const ler = (): Record<string, Decisao> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
};

export function useDecisoes() {
  const [d, setD] = useState<Record<string, Decisao>>(ler);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sem storage: fica em memória */ }
  }, [d]);
  const marcar = useCallback((chave: string, titulo: string, valor: number, status: StatusDecisao) => {
    setD((x) => ({ ...x, [chave]: { chave, titulo, valor, status, em: new Date().toISOString() } }));
  }, []);
  const desfazer = useCallback((chave: string) => setD((x) => { const y = { ...x }; delete y[chave]; return y; }), []);
  return { decisoes: d, marcar, desfazer };
}

export function exportarDecisoes(d: Record<string, Decisao>) {
  const linhas = Object.values(d).sort((a, b) => a.em.localeCompare(b.em));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "﻿" + ["Item;Valor;Status;Registrado em"]
    .concat(linhas.map((l) => [esc(l.titulo), l.valor.toFixed(2).replace(".", ","), l.status, l.em].join(";")))
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "registro_decisoes.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Abre o e-mail com o resumo do item; o destinatário é escolhido por quem envia. */
export function notificar(titulo: string, corpo: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corpo)}`;
}
