// Leitura dos CSVs exportados do DAX Query View (Power BI Desktop, pt-BR):
// separador ";", decimal ",", texto entre aspas, datas "2026-11-01 00:00:00,000".

/** Divide o texto em linhas de campos, respeitando aspas e quebras dentro de aspas. */
export function splitCsv(text, sep = ";") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let wasQuoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; wasQuoted = true; continue; }
    if (c === sep) { row.push({ v: field, q: wasQuoted }); field = ""; wasQuoted = false; continue; }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push({ v: field, q: wasQuoted });
      rows.push(row);
      row = []; field = ""; wasQuoted = false;
      continue;
    }
    field += c;
  }
  if (field !== "" || row.length) { row.push({ v: field, q: wasQuoted }); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].v === "" && !r[0].q));
}

const NUM = /^-?\d+(,\d+)?(E[-+]?\d+)?$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2}:\d{2}(,\d+)?)?$/;

/** Converte um campo: texto entre aspas fica texto; números pt-BR viram number; vazio vira null. */
export function parseValue({ v, q }) {
  if (q) return v;
  const t = v.trim();
  if (t === "") return null;
  if (t === "True" || t === "TRUE") return true;
  if (t === "False" || t === "FALSE") return false;
  if (NUM.test(t)) return Number(t.replace(",", "."));
  const d = DATE.exec(t);
  if (d) return `${d[1]}-${d[2]}-${d[3]}`;
  return t;
}

/** Normaliza o nome de coluna: remove "Tabela[...]" e o prefixo "@" das colunas calculadas. */
export function normalizeHeader(h) {
  const m = /\[([^\]]+)\]\s*$/.exec(h);
  const name = m ? m[1] : h;
  return name.replace(/^@/, "").trim();
}

export function parseCsv(text) {
  const rows = splitCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((c) => normalizeHeader(c.v));
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] ? parseValue(r[i]) : null; });
    return o;
  });
}

/** Garante que as colunas exigidas existem; devolve a lista das que faltam. */
export function missingColumns(rows, required) {
  if (!rows.length) return required.slice();
  const cols = new Set(Object.keys(rows[0]));
  return required.filter((c) => !cols.has(c));
}
