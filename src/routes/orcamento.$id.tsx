import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { brl } from "@/lib/parts";
import {
  deleteOrcamento,
  getOrcamento,
  getSettings,
  saveOrcamento,
  updateOrcamento,
  type Orcamento,
  type Settings,
  type StatusOrc,
} from "@/lib/storage";
import { gerarPDF, gerarTexto } from "@/lib/pdf";
import { gerarOrcamentoPDF } from "@/lib/orcamento-pdf";
import {
  loadOficina,
  loadOrcamentoPdf,
  saveOficina,
  saveOrcamentoPdf,
  type OficinaConfig,
  type OrcamentoPdfConfig,
} from "@/lib/oficina-config";
import { buildPix } from "@/lib/pix";
import { PdfLoadingOverlay } from "@/components/PdfLoadingOverlay";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Wrench,
  Trophy,
  Phone,
  Car,
  Star,
  Package,
  Cog,
  StickyNote,
  TrendingUp,
  CreditCard,
  FileText,
  MessageCircle,
  Copy,
  Pencil,
  Trash2,
  Settings as SettingsIcon,
} from "lucide-react";

export const Route = createFileRoute("/orcamento/$id")({
  head: () => ({ meta: [{ title: "Orçamento — OrçaAr Condicionado Pro" }] }),
  component: Resultado,
});

const STAGES = [
  { key: "enviado", label: "Enviado", Icon: Send, color: "#38BDF8" },
  { key: "aprovado", label: "Aprovado", Icon: CheckCircle2, color: "#22C55E" },
  { key: "andamento", label: "Em andamento", Icon: Wrench, color: "#3B82F6" },
  { key: "concluido", label: "Concluído", Icon: Trophy, color: "#16A34A" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

// Map UI stages to stored status (we keep storage shape unchanged)
const stageToStatus = (k: StageKey): StatusOrc =>
  k === "andamento" ? "aprovado" : (k as StatusOrc);

const stageIndexFromStatus = (s: StatusOrc): number =>
  s === "enviado" ? 0 : s === "aprovado" ? 1 : 3;

function initials(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Resultado() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [o, setO] = useState<Orcamento | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixCode, setPixCode] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  useEffect(() => {
    const found = getOrcamento(id);
    if (!found) {
      navigate({ to: "/" });
      return;
    }
    setO(found);
    setParcelas(found.parcelas ?? 1);
    setS(getSettings());
  }, [id, navigate]);

  if (!o || !s) return null;

  const setStage = (k: StageKey) => {
    const upd = updateOrcamento(o.id, { status: stageToStatus(k) });
    if (upd) setO(upd);
  };

  const setParc = (n: number) => {
    setParcelas(n);
    const upd = updateOrcamento(o.id, { parcelas: n });
    if (upd) setO(upd);
  };

  // Persiste o orçamento atual antes de qualquer ação de saída.
  // Retorna o orçamento salvo, ou null em caso de falha.
  const persistir = (): Orcamento | null => {
    try {
      const atual: Orcamento = { ...o, parcelas };
      saveOrcamento(atual);
      setO(atual);
      toast.success("Orçamento salvo com sucesso ✓", { duration: 2000 });
      return atual;
    } catch (e) {
      console.error("Erro ao salvar orçamento", e);
      toast.error("Erro ao salvar. Tente novamente.");
      return null;
    }
  };

  const fazerPDF = () => {
    const salvo = persistir();
    if (!salvo) return;
    setPdfModalOpen(true);
  };

  const gerarPDFConfirm = async (oficina: OficinaConfig, cfg: OrcamentoPdfConfig) => {
    saveOficina(oficina);
    saveOrcamentoPdf(cfg);
    setPdfModalOpen(false);
    setLoadingPdf(true);
    await new Promise((r) => setTimeout(r, 300));
    try {
      await gerarOrcamentoPDF(o!, { oficina, pdf: cfg });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
      // fallback ao gerador antigo
      try { await gerarPDF(o!, s!); } catch {}
    } finally {
      setTimeout(() => setLoadingPdf(false), 400);
    }
  };

  const whatsapp = () => {
    const salvo = persistir();
    if (!salvo) return;
    const txt = encodeURIComponent(gerarTexto(salvo, s));
    const tel = salvo.cliente.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/${tel}?text=${txt}`, "_blank");
  };

  const copiar = async () => {
    const salvo = persistir();
    if (!salvo) return;
    try {
      await navigator.clipboard.writeText(gerarTexto(salvo, s));
      toast.success("Orçamento copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const excluir = () => {
    deleteOrcamento(o.id);
    navigate({ to: "/" });
  };

  const abrirPix = async () => {
    const salvo = persistir();
    if (!salvo) return;
    if (!s.pixKey.trim()) {
      toast.error("Cadastre sua chave Pix em Configurações.");
      return;
    }
    const code = buildPix({
      chave: s.pixKey.trim(),
      nome: s.pixNome || s.company.nome || "RECEBEDOR",
      cidade: s.pixCidade || "BRASIL",
      valor: salvo.totals.total,
      txid: salvo.id.replace(/-/g, "").slice(0, 25),
    });
    setPixCode(code);
    setPixOpen(true);
    try {
      await navigator.clipboard.writeText(code);
    } catch {}
  };

  const activeIdx = stageIndexFromStatus(o.status);
  const numero = "#" + o.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const margemPct = o.totals.total > 0 ? Math.round((o.totals.lucro / o.totals.total) * 100) : 0;
  const opcoesParcelas = [1, 2, 3, 4, 5, 6];

  const gridBg = {
    backgroundImage:
      "radial-gradient(circle, #0D0D0D 1px, transparent 1px), linear-gradient(#0F0F18 1px, transparent 1px), linear-gradient(90deg, #0F0F18 1px, transparent 1px)",
    backgroundSize: "16px 16px, 32px 32px, 32px 32px",
  } as React.CSSProperties;

  const Divider = () => (
    <div className="flex items-center gap-2 my-1 px-5">
      <div className="flex-1 h-px" style={{ background: "#1E1E2E" }} />
      <Cog size={12} className="text-[#2A2A3A]" />
      <div className="flex-1 h-px" style={{ background: "#1E1E2E" }} />
    </div>
  );

  return (
    <main
      className="min-h-screen pb-32 w-full"
      style={{ background: "#0A0A0F", color: "#FFFFFF" }}
    >
      {/* HEADER */}
      <header
        className="relative px-4 pt-6 pb-5 border-b"
        style={{ borderColor: "#1E1E2E", ...gridBg }}
      >
        <div className="relative flex items-center justify-between">
          <Link
            to="/"
            aria-label="Voltar"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95"
            style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#38BDF8" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="text-center">
            <h1 className="text-white font-bold tracking-wide text-lg leading-none">
              ORÇAMENTO {numero}
            </h1>
            <span
              className="inline-block mt-1 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md"
              style={{ background: "#0D0D0D", color: "#38BDF8" }}
            >
              {new Date(o.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <button
            aria-label="Opções"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95"
            style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#A0A0B0" }}
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* STEPPER */}
      <section className="px-4 py-6 animate-fade-in">
        <div className="flex items-center justify-between">
          {STAGES.map((st, i) => {
            const done = i <= activeIdx;
            const isCurrent = i === activeIdx;
            const Icon = st.Icon;
            return (
              <div key={st.key} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => setStage(st.key)}
                  className="flex flex-col items-center gap-1.5 transition active:scale-95"
                >
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition ${
                      isCurrent ? "animate-pulse" : ""
                    }`}
                    style={{
                      background: done ? `${st.color}1A` : "#12121A",
                      borderColor: done ? st.color : "#1E1E1E",
                      color: done ? st.color : "#555",
                      boxShadow: isCurrent ? `0 0 16px ${st.color}55` : "none",
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: done ? st.color : "#555" }}
                  >
                    {st.label}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1 mb-5"
                    style={{
                      background:
                        i < activeIdx
                          ? "#38BDF8"
                          : "repeating-linear-gradient(90deg,#1E1E1E 0 4px,transparent 4px 8px)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* MAIN CARD */}
      <article
        className="mx-4 rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
      >
        {/* BLOCO A — Cliente & Instalação */}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0"
              style={{ background: "#0D0D0D", color: "#38BDF8" }}
            >
              {initials(o.cliente.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[17px] leading-tight truncate">
                {o.cliente.nome || "Cliente"}
              </p>
              {o.cliente.telefone && (
                <div
                  className="flex items-center gap-1.5 text-sm mt-0.5"
                  style={{ color: "#A0A0B0" }}
                >
                  <Phone size={13} />
                  <span>{o.cliente.telefone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
              style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E5E5EA" }}
            >
              <Car size={12} style={{ color: "#38BDF8" }} />
              {o.veiculo.marcaModelo} {o.veiculo.ano}
              {o.veiculo.placa && ` · ${o.veiculo.placa}`}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
              style={{ background: "#0A0A0F", border: "1px solid #1E1E2E", color: "#E5E5EA" }}
            >
              <Star size={12} style={{ color: "#38BDF8" }} />
              {o.servicoNome}
            </span>
          </div>
        </div>

        {o.fotoDataUrl && (
          <img src={o.fotoDataUrl} alt="Problema" className="w-full h-auto object-cover" />
        )}

        <Divider />

        {/* BLOCO B — Peças */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} style={{ color: "#38BDF8" }} />
            <p className="text-white font-bold text-xs tracking-widest">PEÇAS E MATERIAIS</p>
          </div>
          {o.parts.length === 0 ? (
            <p className="text-sm" style={{ color: "#A0A0B0" }}>Apenas mão de obra.</p>
          ) : (
            <ul className="space-y-2.5">
              {o.parts.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Cog size={14} className="mt-1 shrink-0" style={{ color: "#38BDF8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{p.name}</p>
                    {p.descricao && (
                      <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#A0A0B0" }}>
                        {p.descricao}
                      </p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: "#A0A0B0" }}>
                      {p.qty} {p.unit} × {brl(p.price)}
                    </p>
                  </div>
                  <span className="text-white font-bold text-sm whitespace-nowrap">
                    {brl(p.price * p.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div
            className="flex justify-between items-center mt-3 px-3 py-2 rounded-lg text-sm"
            style={{ background: "#1E1E2E" }}
          >
            <span style={{ color: "#A0A0B0" }}>Subtotal peças</span>
            <span className="text-white font-bold">{brl(o.totals.pecas)}</span>
          </div>
        </div>

        <Divider />

        {/* BLOCO C — Mão de obra */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={16} style={{ color: "#38BDF8" }} />
            <p className="text-white font-bold text-xs tracking-widest">MÃO DE OBRA</p>
          </div>
          {o.servicosDetalhados && o.servicosDetalhados.length ? (
            <ul className="space-y-2.5">
              {o.servicosDetalhados.map((sv, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Wrench size={14} className="mt-1 shrink-0" style={{ color: "#38BDF8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{sv.nome || "Serviço"}</p>
                    {sv.descricao && (
                      <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#A0A0B0" }}>
                        {sv.descricao}
                      </p>
                    )}
                  </div>
                  <span className="text-white font-bold text-sm whitespace-nowrap">
                    {brl(sv.valor)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-between items-center text-sm">
              <span className="text-white">Serviço</span>
              <span className="text-white font-bold">{brl(o.totals.maoObra)}</span>
            </div>
          )}
          <div
            className="flex justify-between items-center mt-3 px-3 py-2 rounded-lg text-sm"
            style={{ background: "#1E1E2E" }}
          >
            <span style={{ color: "#A0A0B0" }}>Subtotal mão de obra</span>
            <span className="text-white font-bold">{brl(o.totals.maoObra)}</span>
          </div>
        </div>

        {o.observacoes && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote size={16} style={{ color: "#38BDF8" }} />
                <p className="text-white font-bold text-xs tracking-widest">OBSERVAÇÕES</p>
              </div>
              <div
                className="text-sm p-3 rounded-lg whitespace-pre-wrap"
                style={{
                  background: "#141414",
                  borderLeft: "2px solid #38BDF8",
                  color: "#D4D4D8",
                }}
              >
                {o.observacoes}
              </div>
            </div>
          </>
        )}

        {/* BLOCO E — Resumo financeiro */}
        <div
          className="px-5 py-5 mt-1"
          style={{ background: "#000000", borderTop: "2px solid #38BDF8" }}
        >
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#A0A0B0" }}>Subtotal peças</span>
              <span className="text-white">{brl(o.totals.pecas)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#A0A0B0" }}>Mão de obra</span>
              <span className="text-white">{brl(o.totals.maoObra)}</span>
            </div>
          </div>
          <div className="my-3 h-px" style={{ background: "#1E1E2E" }} />
          <div className="flex justify-between items-center">
            <span className="text-white font-bold tracking-wide">TOTAL</span>
            <span className="font-bold text-2xl" style={{ color: "#38BDF8" }}>
              {brl(o.totals.total)}
            </span>
          </div>
          {parcelas >= 2 && (
            <p className="text-xs text-right mt-1" style={{ color: "#A0A0B0" }}>
              ou {parcelas}× de {brl(o.totals.total / parcelas)} sem juros
            </p>
          )}
          <div className="flex justify-between items-center mt-3">
            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "#22C55E" }}>
              <TrendingUp size={14} />
              Lucro estimado
            </span>
            <span className="font-bold text-sm" style={{ color: "#22C55E" }}>
              {brl(o.totals.lucro)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs" style={{ color: "#86EFAC" }}>Margem aplicada</span>
            <span className="text-xs font-bold" style={{ color: "#86EFAC" }}>{margemPct}%</span>
          </div>
        </div>
      </article>

      {/* PARCELAMENTO */}
      <section className="mx-4 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={16} style={{ color: "#38BDF8" }} />
          <p className="text-white font-bold text-xs tracking-widest">CONDIÇÃO DE PAGAMENTO</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {opcoesParcelas.map((n) => {
            const sel = parcelas === n;
            return (
              <button
                key={n}
                onClick={() => setParc(n)}
                className="rounded-xl p-2.5 text-left transition active:scale-95"
                style={{
                  background: sel ? "#0D0D0D" : "#0D0D0D",
                  border: sel ? "1.5px solid #38BDF8" : "1px solid #1E1E1E",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">
                    {n === 1 ? "À vista" : `${n}×`}
                  </span>
                  {n === 1 && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "#0F3D24", color: "#22C55E" }}
                    >
                      S/ JUROS
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "#A0A0B0" }}>
                  {brl(o.totals.total / n)}
                  {n > 1 ? "/mês" : ""}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* AÇÕES */}
      <section className="mx-4 mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={fazerPDF}
            className="flex items-center justify-center gap-2 font-bold text-sm py-4 rounded-2xl transition active:scale-95"
            style={{ background: "#38BDF8", color: "#0A0A0F" }}
          >
            <FileText size={18} />
            GERAR PDF
          </button>
          <button
            onClick={whatsapp}
            className="flex items-center justify-center gap-2 font-bold text-sm py-4 rounded-2xl text-white transition active:scale-95"
            style={{ background: "#25D366" }}
          >
            <MessageCircle size={18} />
            WHATSAPP
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={copiar}
            className="flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-2xl transition active:scale-95"
            style={{ background: "transparent", border: "1px solid #2A2A3A", color: "#E5E5EA" }}
          >
            <Copy size={16} />
            COPIAR
          </button>
          <Link
            to="/novo"
            search={{ edit: o.id }}
            className="flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-2xl transition active:scale-95"
            style={{ background: "transparent", border: "1px solid #38BDF8", color: "#38BDF8" }}
          >
            <Pencil size={16} />
            EDITAR
          </Link>
        </div>

        {o.status === "concluido" && (
          <button
            onClick={abrirPix}
            className="w-full flex items-center justify-center gap-2 font-bold text-sm py-4 rounded-2xl transition active:scale-95"
            style={{ background: "#22C55E", color: "#0A0A0F" }}
          >
            💸 COBRAR VIA PIX — {brl(o.totals.total)}
          </button>
        )}

        <div className="pt-6 flex justify-center">
          <button
            onClick={() => setConfirmDel(true)}
            className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-lg transition active:scale-95"
            style={{ color: "#EF4444" }}
          >
            <Trash2 size={16} />
            Excluir orçamento
          </button>
        </div>
        {o.updatedAt && (
          <p className="text-center text-[11px] mt-2" style={{ color: "#666" }}>
            Última edição: {new Date(o.updatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      <PdfLoadingOverlay open={loadingPdf} />

      {pixOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(10,10,15,0.9)" }}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-md"
            style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg" style={{ color: "#38BDF8" }}>Pix Copia e Cola</h3>
              <button onClick={() => setPixOpen(false)} className="text-white text-xl">✕</button>
            </div>
            <p className="text-sm mb-2" style={{ color: "#A0A0B0" }}>
              Código copiado! Cole no app do banco do cliente.
            </p>
            <textarea
              readOnly
              value={pixCode}
              className="w-full text-xs rounded-xl p-3 h-32 font-mono"
              style={{ background: "#FFFFFF", color: "#0A0A0F" }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigator.clipboard.writeText(pixCode)}
                className="flex-1 font-bold text-sm py-3 rounded-xl"
                style={{ background: "#38BDF8", color: "#0A0A0F" }}
              >
                Copiar novamente
              </button>
              <button
                onClick={() => setPixOpen(false)}
                className="font-bold text-sm py-3 px-4 rounded-xl text-white"
                style={{ background: "transparent", border: "1px solid #2A2A3A" }}
              >
                Fechar
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: "#A0A0B0" }}>
              Valor: <b className="text-white">{brl(o.totals.total)}</b> • Chave:{" "}
              <span className="text-white">{s.pixKey}</span>
            </p>
          </div>
        </div>
      )}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(10,10,15,0.9)" }}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: "#12121A", border: "1px solid #1E1E2E" }}
          >
            <div className="flex justify-center mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#3A0A0A", color: "#EF4444" }}
              >
                <Trash2 size={22} />
              </div>
            </div>
            <h3 className="text-white font-bold text-center text-lg">Excluir orçamento?</h3>
            <p className="text-sm text-center mt-1" style={{ color: "#A0A0B0" }}>
              Esta ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => setConfirmDel(false)}
                className="font-bold text-sm py-3 rounded-xl text-white"
                style={{ background: "transparent", border: "1px solid #2A2A3A" }}
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                className="font-bold text-sm py-3 rounded-xl text-white"
                style={{ background: "#EF4444" }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfModalOpen && (
        <PdfOrcamentoCustomizeModal
          onClose={() => setPdfModalOpen(false)}
          onConfirm={gerarPDFConfirm}
        />
      )}
    </main>
  );
}

/* ===================== PDF Customize Modal ===================== */

const PDF_MODELOS: { id: "profissional" | "classico" | "minimalista"; nome: string; desc: string }[] = [
  { id: "profissional", nome: "Profissional", desc: "Header escuro · tabelas com destaque" },
  { id: "classico", nome: "Clássico", desc: "Fundo branco · logo centralizada" },
  { id: "minimalista", nome: "Minimalista", desc: "Sem cards · linhas finas" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const initial = hexToRgb(value);
  const initHsv = rgbToHsv(initial.r, initial.g, initial.b);
  const [hsv, setHsv] = useState(initHsv);
  const [mode, setMode] = useState<"hex" | "rgb">("hex");
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  useEffect(() => {
    if (hex !== value.toUpperCase()) onChange(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  // sync if external value changes drastically (e.g., model preset)
  useEffect(() => {
    if (value.toUpperCase() !== hex) {
      const rb = hexToRgb(value);
      setHsv(rgbToHsv(rb.r, rb.g, rb.b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pureHue = hsvToRgb(hsv.h, 1, 1);
  const pureHueHex = rgbToHex(pureHue.r, pureHue.g, pureHue.b);

  const handlePad = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const move = (cx: number, cy: number) => {
      const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
      setHsv((p) => ({ ...p, s: x, v: 1 - y }));
    };
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent).nativeEvent;
    move((t as Touch).clientX ?? (e as React.MouseEvent).clientX, (t as Touch).clientY ?? (e as React.MouseEvent).clientY);
  };

  return (
    <div className="rounded-lg p-3" style={{ background: "#000000", border: "1px solid #1E1E1E" }}>
      {/* gradient pad */}
      <div
        className="relative w-full rounded-md cursor-crosshair select-none"
        style={{
          height: 140,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHueHex})`,
        }}
        onMouseDown={(e) => {
          handlePad(e);
          const onMove = (ev: MouseEvent) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
            setHsv((p) => ({ ...p, s: x, v: 1 - y }));
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        onTouchStart={handlePad}
        onTouchMove={handlePad}
      >
        <div
          className="absolute size-3 rounded-full pointer-events-none"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            transform: "translate(-50%, -50%)",
            background: "#fff",
            border: "1px solid #000",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.4)",
          }}
        />
      </div>

      {/* hue slider */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.h)}
          onChange={(e) => setHsv((p) => ({ ...p, h: Number(e.target.value) }))}
          className="w-full appearance-none cursor-pointer"
          style={{
            height: 10,
            borderRadius: 6,
            background:
              "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
          }}
        />
      </div>

      {/* preview + inputs */}
      <div className="mt-3 flex items-center gap-3">
        <div
          className="rounded-full shrink-0"
          style={{ width: 40, height: 40, background: hex, border: "2px solid #fff", boxShadow: "0 0 0 1px #1E1E1E" }}
        />
        <div className="flex-1">
          {mode === "hex" ? (
            <div className="flex items-center rounded-md overflow-hidden" style={{ background: "#0D0D0D", border: "1px solid #1E1E1E" }}>
              <span className="px-2 text-sm" style={{ color: "#A0A0A0" }}>#</span>
              <input
                value={hex.replace("#", "")}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                  if (v.length === 6) {
                    const r = hexToRgb("#" + v);
                    setHsv(rgbToHsv(r.r, r.g, r.b));
                  }
                }}
                className="flex-1 bg-transparent text-white text-sm py-2 outline-none uppercase"
                style={{ letterSpacing: 1 }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {(["r", "g", "b"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  min={0}
                  max={255}
                  value={Math.round(rgb[k])}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                    const next = { ...rgb, [k]: n };
                    setHsv(rgbToHsv(next.r, next.g, next.b));
                  }}
                  className="text-center bg-[#0D0D0D] text-white text-sm py-2 rounded-md outline-none"
                  style={{ border: "1px solid #1E1E1E" }}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "hex" ? "rgb" : "hex"))}
          className="text-[10px] font-bold px-2 py-2 rounded-md"
          style={{ background: "#0D0D0D", border: "1px solid #1E1E1E", color: "#A0A0A0" }}
        >
          {mode === "hex" ? "RGB" : "HEX"}
        </button>
      </div>
    </div>
  );
}

function ModeloMiniPreview({ modelo, cor }: { modelo: "profissional" | "classico" | "minimalista"; cor: string }) {
  const box: React.CSSProperties = { width: "100%", height: 100, borderRadius: 6, overflow: "hidden", position: "relative" };
  if (modelo === "profissional") {
    return (
      <div style={{ ...box, background: "#fff" }}>
        <div style={{ height: 22, background: "#000000", display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
          <div style={{ width: 12, height: 12, background: cor, borderRadius: 2 }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 30, height: 5, background: cor, borderRadius: 1 }} />
        </div>
        <div style={{ padding: 6 }}>
          <div style={{ height: 4, background: cor, marginBottom: 4 }} />
          <div style={{ height: 3, background: "#ddd", marginBottom: 2 }} />
          <div style={{ height: 3, background: "#eee", marginBottom: 6 }} />
          <div style={{ height: 4, background: cor, marginBottom: 4 }} />
          <div style={{ height: 3, background: "#ddd", marginBottom: 2 }} />
          <div style={{ height: 12, background: "#000000", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
            <div style={{ width: 24, height: 4, background: cor }} />
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: cor }} />
      </div>
    );
  }
  if (modelo === "classico") {
    return (
      <div style={{ ...box, background: "#fff", padding: 6 }}>
        <div style={{ width: 16, height: 16, background: "#ddd", borderRadius: 8, margin: "0 auto 3px" }} />
        <div style={{ width: 50, height: 4, background: "#1E1E1E", margin: "0 auto 2px" }} />
        <div style={{ width: 36, height: 2, background: "#bbb", margin: "0 auto 4px" }} />
        <div style={{ height: 1, background: cor, margin: "0 4px 4px" }} />
        <div style={{ height: 2, background: "#ccc", margin: "0 4px 3px" }} />
        <div style={{ height: 2, background: "#ccc", margin: "0 4px 3px" }} />
        <div style={{ height: 2, background: "#ccc", margin: "0 4px 3px" }} />
        <div style={{ height: 1, background: cor, margin: "4px 4px 2px" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px" }}>
          <div style={{ width: 26, height: 4, background: cor }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...box, background: "#fff", padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, background: "#ddd", borderRadius: 2 }} />
        <div style={{ width: 40, height: 3, background: "#1E1E1E" }} />
      </div>
      <div style={{ width: 30, height: 5, background: cor, marginBottom: 6 }} />
      <div style={{ height: 1, background: "#eee", marginBottom: 3 }} />
      <div style={{ height: 1, background: "#eee", marginBottom: 3 }} />
      <div style={{ height: 1, background: "#eee", marginBottom: 3 }} />
      <div style={{ height: 1, background: "#eee", marginBottom: 6 }} />
      <div style={{ height: 1, background: cor, marginBottom: 3 }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ width: 18, height: 4, background: "#1E1E1E" }} />
        <div style={{ width: 22, height: 4, background: cor }} />
      </div>
    </div>
  );
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function PdfOrcamentoCustomizeModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (oficina: OficinaConfig, cfg: OrcamentoPdfConfig) => void;
}) {
  const [oficina, setOficina] = useState<OficinaConfig>(() => loadOficina());
  const [cfg, setCfg] = useState<OrcamentoPdfConfig>(() => loadOrcamentoPdf());

  const setLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter até 2MB");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      setCfg((c) => ({ ...c, logoDataUrl: url }));
      setOficina((o) => ({ ...o, logoDataUrl: url }));
    };
    r.readAsDataURL(file);
  };

  const Toggle = ({ k, label }: { k: keyof OrcamentoPdfConfig; label: string }) => (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-white">{label}</span>
      <input
        type="checkbox"
        checked={Boolean(cfg[k])}
        onChange={(e) => setCfg((c) => ({ ...c, [k]: e.target.checked }))}
        className="size-4 accent-yellow-400"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: "#0D0D0D",
          border: "1px solid #1E1E1E",
          borderTop: `2px solid ${cfg.corDestaque}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Pencil size={16} style={{ color: cfg.corDestaque }} /> Personalizar PDF
          </h3>
          <button onClick={onClose} className="text-white">✕</button>
        </div>

        {/* MODELO DO PDF */}
        <p className="text-[11px] uppercase tracking-wider mb-2 font-bold" style={{ color: "#A0A0A0" }}>
          Modelo do PDF
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-2">
          {PDF_MODELOS.map((m) => {
            const sel = (cfg.modelo ?? "profissional") === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCfg((c) => ({ ...c, modelo: m.id }))}
                className="text-left rounded-lg p-2 transition"
                style={{
                  background: sel ? "#0D0D0D" : "#0D0D0D",
                  border: sel ? `2px solid ${cfg.corDestaque}` : "1px solid #1E1E1E",
                }}
              >
                <ModeloMiniPreview modelo={m.id} cor={cfg.corDestaque} />
                <div className="mt-2 text-white text-[12px] font-bold">{m.nome}</div>
                <div className="text-[10px]" style={{ color: "#A0A0A0" }}>{m.desc}</div>
                <div
                  className="mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded inline-block"
                  style={
                    sel
                      ? { background: cfg.corDestaque, color: "#000000" }
                      : { border: "1px solid #1E1E1E", color: "#A0A0A0" }
                  }
                >
                  {sel ? "● SELECIONADO" : "SELECIONAR"}
                </div>
              </button>
            );
          })}
        </div>

        {/* LOGO */}
        <p className="text-[11px] uppercase tracking-wider mt-4 mb-2 font-bold" style={{ color: "#A0A0A0" }}>
          Logo da loja
        </p>
        <label
          className="block relative cursor-pointer rounded-lg overflow-hidden"
          style={{ width: "100%", height: 90, background: "#000000", border: "1px dashed #38BDF8" }}
        >
          {cfg.logoDataUrl ? (
            <>
              <img src={cfg.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setCfg((c) => ({ ...c, logoDataUrl: undefined }));
                  setOficina((o) => ({ ...o, logoDataUrl: undefined }));
                }}
                className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded"
                style={{ background: "#FF4444", color: "#fff" }}
              >
                ✕ Remover
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[11px]" style={{ color: "#A0A0A0" }}>
              <span style={{ color: "#38BDF8", fontSize: 20 }}>📷</span>
              Clique para adicionar logo
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => setLogo(e.target.files?.[0])}
          />
        </label>

        {/* DADOS DA OFICINA */}
        <p className="text-[11px] uppercase tracking-wider mt-4 mb-2" style={{ color: "#A0A0A0" }}>
          Dados da oficina
        </p>
        <div className="space-y-2">
          {[
            { k: "nome", ph: "Nome da Loja *" },
            { k: "endereco", ph: "Endereço completo" },
            { k: "telefone", ph: "Telefone / WhatsApp" },
            { k: "cnpj", ph: "CNPJ" },
            { k: "email", ph: "E-mail" },
            { k: "website", ph: "Website (opcional)" },
          ].map((f) => (
            <input
              key={f.k}
              placeholder={f.ph}
              value={(oficina as Record<string, string | undefined>)[f.k] ?? ""}
              onChange={(e) =>
                setOficina((o) => ({
                  ...o,
                  [f.k]: f.k === "cnpj" ? maskCNPJ(e.target.value) : e.target.value,
                }))
              }
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
            />
          ))}
        </div>

        {/* CORES */}
        <p className="text-[11px] uppercase tracking-wider mt-4 mb-2 font-bold" style={{ color: "#A0A0A0" }}>
          Cor de destaque do documento
        </p>
        <ColorPicker
          value={cfg.corDestaque}
          onChange={(hex) => setCfg((x) => ({ ...x, corDestaque: hex }))}
        />

        {/* RODAPÉ */}
        <p className="text-[11px] uppercase tracking-wider mt-4 mb-2" style={{ color: "#A0A0A0" }}>
          Texto do rodapé
        </p>
        <textarea
          value={cfg.rodapeTexto}
          onChange={(e) => setCfg((c) => ({ ...c, rodapeTexto: e.target.value }))}
          rows={3}
          placeholder="Ex: Orçamento válido por 7 dias. Peças com garantia de 90 dias."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
          style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
        />

        {/* OPÇÕES */}
        <p className="text-[11px] uppercase tracking-wider mt-4 mb-1" style={{ color: "#A0A0A0" }}>
          Opções do PDF
        </p>
        <div className="divide-y" style={{ borderColor: "#1E1E1E" }}>
          <Toggle k="mostrarValidade" label="Mostrar validade do orçamento (7 dias)" />
          <Toggle k="mostrarVeiculo" label="Mostrar dados do equipamento" />
          <Toggle k="mostrarSeparacao" label="Mostrar separação Peças/Serviços" />
          <Toggle k="mostrarNumeroOS" label="Mostrar número do orçamento/OS" />
          <Toggle k="mostrarObservacoes" label="Mostrar observações" />
        </div>

        {/* BOTÕES */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="font-bold text-sm py-3 px-4 rounded-xl"
            style={{ background: "transparent", color: "#A0A0A0" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(oficina, cfg)}
            className="flex-1 font-bold text-sm py-3 rounded-xl"
            style={{ background: cfg.corDestaque, color: "#000000" }}
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
