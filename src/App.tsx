import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, Gauge, Moon, Sun } from "lucide-react";
import type { Bundle } from "./types";
import { useDecisoes, type Decisao, type StatusDecisao } from "./lib/decisoes";
import { loadBundle } from "./lib/dataSource";
import { dataBR, mes } from "./lib/format";
import Situacao from "./pages/Situacao";
import Projetos from "./pages/Projetos";
import Operacional from "./pages/Operacional";
import SobreDados from "./components/SobreDados";
import ProjetoDrawer from "./components/ProjetoDrawer";

export type Aba = "situacao" | "projetos" | "operacional";
export interface Filtro { classe?: string; fila?: string; somenteReal?: boolean; area?: string }

interface Ctx {
  b: Bundle;
  ir: (aba: Aba, filtro?: Filtro) => void;
  filtro: Filtro;
  abrirProjeto: (id: string) => void;
  decisoes: Record<string, Decisao>;
  marcar: (chave: string, titulo: string, valor: number, status: StatusDecisao) => void;
  desfazer: (chave: string) => void;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("Contexto não inicializado");
  return c;
};

const ABAS: { id: Aba; label: string; Icon: typeof Gauge; nivel: string }[] = [
  { id: "situacao", label: "1 · Situação do orçamento", Icon: Gauge, nivel: "Diretor e gerência" },
  { id: "projetos", label: "2 · Projetos e emissão", Icon: BarChart3, nivel: "Gerência" },
  { id: "operacional", label: "3 · Execução e qualidade", Icon: ClipboardList, nivel: "Time de execução" },
];

function abaDaUrl(): Aba {
  const h = window.location.hash.replace("#", "") as Aba;
  return ABAS.some((a) => a.id === h) ? h : "situacao";
}

export default function App() {
  const [b, setB] = useState<Bundle | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(abaDaUrl);
  const [filtro, setFiltro] = useState<Filtro>({});
  const [projeto, setProjeto] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [tema, setTema] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("tema") as "light" | "dark") || "light"; } catch { return "light"; }
  });

  useEffect(() => { loadBundle().then(setB).catch((e) => setErro(String(e.message ?? e))); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem("tema", tema); } catch { /* sem storage */ }
  }, [tema]);
  useEffect(() => {
    const f = () => { setProjeto(null); setAba(abaDaUrl()); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const ir = useCallback((a: Aba, f: Filtro = {}) => {
    setFiltro(f);
    setProjeto(null);
    setAba(a);
    if (window.location.hash !== `#${a}`) window.history.pushState(null, "", `#${a}`);
    window.scrollTo({ top: 0 });
  }, []);

  const { decisoes, marcar, desfazer } = useDecisoes();
  const ctx = useMemo(() => (b ? { b, ir, filtro, abrirProjeto: setProjeto, decisoes, marcar, desfazer } : null), [b, ir, filtro, decisoes, marcar, desfazer]);

  if (erro) return <div className="p-10 text-crit">Erro ao carregar os dados: {erro}</div>;
  if (!ctx || !b) return <div className="p-10 text-ink-muted">Carregando painel…</div>;

  const p = b.parametros;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur no-print">
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="flex items-center gap-4 h-14">
              <div className="flex items-center gap-2.5">
                <img src="/favicon.svg" alt="" className="h-7 w-7" />
                <div className="leading-tight">
                  <div className="text-[15px] font-bold">BG de Reservas · Decisão</div>
                  <div className="text-[11px] text-ink-faint">CAPEX · MDO, Instalação e Reserva</div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => setSobre(true)} title={b.meta.avisos.length ? b.meta.avisos.join("\n") : "Dados do modelo, extração sem pendências"}
                  className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-card-alt tabular">
                  <span className={`h-2 w-2 rounded-full ${b.meta.avisos.length ? "bg-warn" : "bg-ok"}`} aria-hidden />
                  Dados de {dataBR(b.meta.dataReferencia)} · caixa {mes(p.mesCorrenteCaixa)}
                  {b.meta.avisos.length > 0 && <span className="sr-only">({b.meta.avisos.length} avisos)</span>}
                </button>
                <button type="button" onClick={() => setTema(tema === "light" ? "dark" : "light")} className="rounded-md p-2 text-ink-muted hover:bg-card-alt" aria-label="Alternar tema">
                  {tema === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Telas">
              {ABAS.map(({ id, label, Icon, nivel }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => ir(id)}
                  title={nivel}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-semibold ${aba === id ? "border-info text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
                >
                  <Icon size={15} aria-hidden /> {label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-6 py-6">
          {aba === "situacao" && <Situacao />}
          {aba === "projetos" && <Projetos />}
          {aba === "operacional" && <Operacional />}
        </main>

        <footer className="mx-auto max-w-[1440px] px-6 pb-8 text-[11px] text-ink-faint">
          Fonte: modelo "[SM] Acompanhamento Mensal Caixa", extração de {dataBR(b.meta.dataReferencia)}. Recomendações não são decisões aprovadas.
        </footer>
      </div>
      <SobreDados open={sobre} onClose={() => setSobre(false)} />
      <ProjetoDrawer id={projeto} onClose={() => setProjeto(null)} />
    </AppCtx.Provider>
  );
}
