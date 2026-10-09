import type { Bundle } from "../types";

/**
 * Fonte de dados do painel: JSON gerado no build a partir dos CSVs do Power BI
 * (scripts/buildBundle.mjs). Se a fonte mudar (BigQuery/Fabric/API), só esta função muda.
 */
const DATA_URL = `${import.meta.env.BASE_URL}data/bundle.json`;

export async function loadBundle(): Promise<Bundle> {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não foi possível carregar ${DATA_URL} (HTTP ${res.status}). Rode "npm run data".`);
  return res.json() as Promise<Bundle>;
}
