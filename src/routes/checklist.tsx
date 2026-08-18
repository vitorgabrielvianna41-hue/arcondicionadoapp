import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  History,
  ChevronDown,
  Check,
  AlertTriangle,
  Trash2,
  Camera,
  X,
  FileText,
  Home,
  Building2,
  Search,
  Eye,
  FileDown,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import {
  searchClientes,
  saveOrcamento,
  getSettings,
  type Orcamento,
} from "@/lib/storage";
import { jsPDF } from "jspdf";
import {
  loadOficina,
  saveOficina,
  loadPdfOptions,
  savePdfOptions,
  type OficinaConfig,
  type PdfOptions,
} from "@/lib/oficina-config";
import { gerarChecklistPdfPro } from "@/lib/checklist-pdf";
import {
  type Checklist,
  type ChecklistFase,
  type ChecklistTipo,
  type Avaria,
  listChecklists,
  saveChecklist,
  deleteChecklist,
  findLastByPlaca,
  gerarNumeroOS,
  getSecoes,
  itemKey,
} from "@/lib/checklist-storage";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [{ title: "Checklist — OrçaAr Condicionado Pro" }],
  }),
  component: ChecklistPage,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyChecklist(tipo: ChecklistTipo, fase: ChecklistFase): Checklist {
  return {
    id: uid(),
    os: gerarNumeroOS(),
    tipo,
    fase,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cliente: "",
    telefone: "",
    placa: "",
    modelo: "",
    km: "",
    combustivel: 50,
    itens: {},
    avarias: [],
    observacoes: "",
    fotos: [],
  };
}

function ChecklistPage() {
  const [view, setView] = useState<"editor" | "historico">("editor");
  const [readOnly, setReadOnly] = useState(false);
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<ChecklistTipo>("carro");
  const [fase, setFase] = useState<ChecklistFase>("entrada");
  const [checklist, setChecklist] = useState<Checklist>(() =>
    emptyChecklist("carro", "entrada"),
  );
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    externa: true,
  });
  const [showSign, setShowSign] = useState(false);

  const secoes = useMemo(() => getSecoes(tipo), [tipo]);

  // Atualiza tipo/fase no checklist quando muda
  useEffect(() => {
    setChecklist((c) => ({ ...c, tipo, fase }));
  }, [tipo, fase]);

  // Pré-preenche saída a partir da entrada da mesma placa
  useEffect(() => {
    if (fase !== "saida") return;
    const placa = checklist.placa;
    if (!placa) return;
    const prev = findLastByPlaca(placa, "entrada");
    if (prev) {
      setChecklist((c) => ({
        ...c,
        cliente: c.cliente || prev.cliente,
        telefone: c.telefone || prev.telefone,
        modelo: c.modelo || prev.modelo,
        km: c.km || prev.km,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // Progresso
  const totalItens = secoes.reduce((s, sec) => s + sec.itens.length, 0);
  const verificados = Object.values(checklist.itens).filter((i) => i.checked).length;
  const progresso = totalItens === 0 ? 0 : Math.round((verificados / totalItens) * 100);

  // Itens com problema (resumo)
  const problemas: { secao: string; texto: string }[] = [];
  for (const sec of secoes) {
    sec.itens.forEach((txt, idx) => {
      const st = checklist.itens[itemKey(sec.id, idx)];
      if (st?.problema) problemas.push({ secao: sec.titulo, texto: txt });
    });
  }

  function patch<K extends keyof Checklist>(key: K, val: Checklist[K]) {
    setChecklist((c) => ({ ...c, [key]: val }));
  }

  function toggleItem(k: string) {
    setChecklist((c) => ({
      ...c,
      itens: {
        ...c.itens,
        [k]: { checked: !c.itens[k]?.checked, problema: c.itens[k]?.problema ?? false },
      },
    }));
  }

  function toggleProblema(k: string) {
    setChecklist((c) => ({
      ...c,
      itens: {
        ...c.itens,
        [k]: { checked: c.itens[k]?.checked ?? false, problema: !c.itens[k]?.problema },
      },
    }));
  }

  function sucessoToast(msg: string) {
    toast.success(msg, {
      duration: 3000,
      style: {
        background: "#38BDF8",
        color: "#000000",
        border: "1px solid #38BDF8",
        fontWeight: 700,
      },
    });
  }

  function gerarOS() {
    // Salva o checklist primeiro
    saveChecklist(checklist);
    const settings = getSettings();
    const problemasList = problemas.map((p) => `${p.secao}: ${p.texto}`);
    const obs = [
      `Origem: Checklist ${checklist.fase.toUpperCase()} — OS ${checklist.os}`,
      checklist.placa ? `Endereço: ${checklist.placa}` : "",
      checklist.modelo ? `Imóvel: ${checklist.modelo}` : "",
      checklist.km ? `Padrão: ${checklist.km}` : "",
      problemasList.length ? "Itens com problema:" : "",
      ...problemasList.map((p) => `• ${p}`),
      checklist.observacoes ? `\nObservações: ${checklist.observacoes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const novoOrc: Orcamento = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      cliente: { nome: checklist.cliente || "", telefone: checklist.telefone || "" },
      veiculo: {
        marcaModelo: checklist.modelo || "",
        ano: "",
        placa: checklist.placa || "",
      },
      servicoId: "checklist",
      servicoNome: `Serviços do Checklist (${problemas.length} item${problemas.length === 1 ? "" : "s"})`,
      motorL: 0,
      cilindros: 4,
      margem: settings.margemPadrao,
      maoObra: 0,
      parts: [],
      totals: { pecas: 0, maoObra: 0, total: 0, lucro: 0 },
      status: "enviado",
      observacoes: obs,
      parcelas: 1,
    };
    saveOrcamento(novoOrc);
    sucessoToast("✓ OS criada em Orçamentos!");
    navigate({ to: "/orcamento/$id", params: { id: novoOrc.id } });
  }

  function finalizar(assinatura?: string) {
    const finalC = {
      ...checklist,
      assinaturaDataUrl: assinatura,
      finalizado: true,
      updatedAt: new Date().toISOString(),
    };
    saveChecklist(finalC);
    setChecklist(finalC);
    setShowSign(false);
    sucessoToast("✓ Checklist salvo com sucesso!");
    setReadOnly(false);
    setView("historico");
  }

  function novoChecklist() {
    setChecklist(emptyChecklist(tipo, fase));
    setSecoesAbertas({ externa: true });
    toast.success("Novo checklist iniciado.");
  }

  // ===== Render =====
  if (view === "historico") {
    return (
      <HistoricoView
        onBack={() => setView("editor")}
        onOpen={(c, ro) => {
          setChecklist(c);
          setTipo(c.tipo);
          setFase(c.fase);
          setReadOnly(!!ro);
          setView("editor");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40" style={{ background: "#000000", color: "#FFFFFF" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-4 py-3"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #38BDF8" }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck size={24} style={{ color: "#38BDF8" }} />
            <div className="min-w-0">
              <h1 className="text-base font-bold uppercase tracking-wide truncate">CHECKLIST</h1>
              <p className="text-xs" style={{ color: "#A0A0A0" }}>
                Vistoria de climatização — antes e depois
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("historico")}
            className="p-2 rounded-md"
            style={{ background: "#000000", border: "1px solid #1E1E1E" }}
            aria-label="Histórico"
          >
            <History size={18} style={{ color: "#38BDF8" }} />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Seletor de tipo */}
        <div className="flex gap-2">
          <ChipTipo
            active={tipo === "carro"}
            onClick={() => setTipo("carro")}
            icon={<Home size={16} />}
            label="Residencial"
          />
          <ChipTipo
            active={tipo === "moto"}
            onClick={() => setTipo("moto")}
            icon={<Building2 size={16} />}
            label="Comercial"
          />
        </div>

        {/* Seletor de fase */}
        <div className="grid grid-cols-2 gap-2">
          <ToggleFase active={fase === "entrada"} onClick={() => setFase("entrada")}>
            ENTRADA
          </ToggleFase>
          <ToggleFase active={fase === "saida"} onClick={() => setFase("saida")}>
            SAÍDA
          </ToggleFase>
        </div>

        {/* Dados do serviço */}
        <DadosServicoCard checklist={checklist} onPatch={patch} />

        {/* Pontos de atenção (opcional) */}
        <PontosAtencaoCard
          avarias={checklist.avarias}
          onAdd={() => patch("avarias", [...checklist.avarias, { id: uid(), x: 0, y: 0, desc: "" }])}
          onUpdate={(id, desc) =>
            patch(
              "avarias",
              checklist.avarias.map((x) => (x.id === id ? { ...x, desc } : x)),
            )
          }
          onRemove={(id) => patch("avarias", checklist.avarias.filter((x) => x.id !== id))}
        />


        {/* Progresso */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs" style={{ color: "#A0A0A0" }}>
            <span>Progresso</span>
            <span>
              {verificados}/{totalItens} itens · {progresso}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#0D0D0D" }}>
            <div
              className="h-full transition-all"
              style={{ width: `${progresso}%`, background: "#38BDF8" }}
            />
          </div>
        </div>

        {/* Resumo problemas */}
        {problemas.length > 0 && (
          <div
            className="rounded-lg p-3"
            style={{ background: "#2A0000", border: "1px solid #FF4444" }}
          >
            <div className="flex items-center gap-2 mb-2" style={{ color: "#FF4444" }}>
              <AlertTriangle size={16} />
              <span className="font-bold text-sm uppercase">
                Itens que precisam de atenção ({problemas.length})
              </span>
            </div>
            <ul className="text-xs space-y-1" style={{ color: "#FFD0D0" }}>
              {problemas.map((p, i) => (
                <li key={i}>
                  • <span style={{ color: "#A0A0A0" }}>{p.secao}:</span> {p.texto}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Seções */}
        <div className="space-y-3">
          {secoes.map((sec) => {
            const aberta = secoesAbertas[sec.id] ?? false;
            const totSec = sec.itens.length;
            const verSec = sec.itens.filter((_, i) => checklist.itens[itemKey(sec.id, i)]?.checked)
              .length;
            return (
              <div
                key={sec.id}
                className="rounded-lg overflow-hidden"
                style={{ background: "#0D0D0D", border: "1px solid #1E1E1E" }}
              >
                <button
                  onClick={() =>
                    setSecoesAbertas((s) => ({ ...s, [sec.id]: !aberta }))
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={16} style={{ color: "#38BDF8" }} />
                    <span className="font-bold uppercase text-sm" style={{ color: "#38BDF8" }}>
                      {sec.titulo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "#A0A0A0" }}>
                      {verSec}/{totSec}
                    </span>
                    <ChevronDown
                      size={18}
                      style={{
                        color: "#A0A0A0",
                        transform: aberta ? "rotate(180deg)" : "none",
                        transition: "transform .2s",
                      }}
                    />
                  </div>
                </button>
                {aberta && (
                  <ul className="px-2 pb-3 space-y-1">
                    {sec.itens.map((txt, idx) => {
                      const k = itemKey(sec.id, idx);
                      const st = checklist.itens[k];
                      return (
                        <li
                          key={k}
                          className="flex items-center gap-3 px-2 py-2 rounded-md"
                          style={{ background: st?.checked ? "#0D0D0D" : "transparent" }}
                        >
                          <button
                            onClick={() => toggleItem(k)}
                            className="shrink-0 w-5 h-5 rounded grid place-items-center"
                            style={{
                              background: st?.checked ? "#38BDF8" : "transparent",
                              border: "1.5px solid #38BDF8",
                            }}
                            aria-label="Marcar"
                          >
                            {st?.checked && <Check size={14} style={{ color: "#000000" }} />}
                          </button>
                          <span className="flex-1 text-sm">{txt}</span>
                          <button
                            onClick={() => toggleProblema(k)}
                            className="text-[10px] font-bold uppercase px-2 py-1 rounded"
                            style={{
                              background: st?.problema ? "#FF4444" : "transparent",
                              color: st?.problema ? "#fff" : "#FF4444",
                              border: "1px solid #FF4444",
                            }}
                            title="Marcar problema"
                          >
                            ⚠ Atenção
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Observações */}
        <div>
          <label className="text-xs uppercase font-bold" style={{ color: "#A0A0A0" }}>
            Observações gerais
          </label>
          <textarea
            value={checklist.observacoes}
            onChange={(e) => patch("observacoes", e.target.value)}
            rows={4}
            placeholder="Descreva sintomas relatados (não gela, ruído, vazamento), condições do local e observações importantes..."
            className="mt-1 w-full rounded-md p-3 text-sm outline-none"
            style={{
              background: "#000000",
              border: "1px solid #1E1E1E",
              color: "#FFFFFF",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "1px solid #38BDF8")}
            onBlur={(e) => (e.currentTarget.style.border = "1px solid #1E1E1E")}
          />
        </div>

        {/* Fotos */}
        <FotosBlock
          fotos={checklist.fotos}
          onAdd={(f) => patch("fotos", [...checklist.fotos, ...f])}
          onRemove={(id) => patch("fotos", checklist.fotos.filter((x) => x.id !== id))}
        />

        <div className="text-center text-xs" style={{ color: "#666" }}>
          OS: {checklist.os} · Atualizado{" "}
          {new Date(checklist.updatedAt).toLocaleString("pt-BR")}
          {checklist.finalizado && " · ✓ Finalizado"}
        </div>

        <button
          onClick={novoChecklist}
          className="w-full text-xs py-2 rounded-md"
          style={{ background: "transparent", color: "#A0A0A0", border: "1px dashed #1E1E1E" }}
        >
          + Novo checklist
        </button>
      </div>

      {/* Rodapé fixo */}
      <div
        className="fixed bottom-[64px] inset-x-0 z-30"
        style={{ background: "#0D0D0D", borderTop: "1px solid #38BDF8" }}
      >
        <div className="max-w-xl mx-auto px-4 py-3 grid grid-cols-2 gap-2">
          <button
            onClick={gerarOS}
            className="py-3 rounded-md font-bold text-sm uppercase flex items-center justify-center gap-2"
            style={{ background: "#0D0D0D", color: "#38BDF8", border: "1px solid #38BDF8" }}
          >
            <FileText size={16} /> Gerar OS
          </button>
          <button
            onClick={() => setShowSign(true)}
            className="py-3 rounded-md font-bold text-sm uppercase"
            style={{ background: "#38BDF8", color: "#000000" }}
          >
            Finalizar checklist
          </button>
        </div>
      </div>

      {showSign && (
        <AssinaturaModal onClose={() => setShowSign(false)} onConfirm={finalizar} />
      )}

      <BottomNav />
    </div>
  );
}

// ============ Subcomponents ============

function ChipTipo({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold"
      style={{
        background: active ? "#38BDF8" : "#0D0D0D",
        color: active ? "#000000" : "#A0A0A0",
        border: active ? "1px solid #38BDF8" : "1px solid #1E1E1E",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ToggleFase({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="py-2.5 rounded-md text-xs font-bold uppercase tracking-wider"
      style={{
        background: active ? "#38BDF8" : "#0D0D0D",
        color: active ? "#000000" : "#A0A0A0",
        border: "1px solid " + (active ? "#38BDF8" : "#1E1E1E"),
      }}
    >
      {children}
    </button>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  list,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  list?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-bold" style={{ color: "#A0A0A0" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        list={list}
        readOnly={readOnly}
        className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none"
        style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#FFFFFF" }}
        onFocus={(e) => (e.currentTarget.style.border = "1px solid #38BDF8")}
        onBlurCapture={(e) => (e.currentTarget.style.border = "1px solid #1E1E1E")}
      />
    </div>
  );
}

function DadosServicoCard({
  checklist,
  onPatch,
}: {
  checklist: Checklist;
  onPatch: <K extends keyof Checklist>(k: K, v: Checklist[K]) => void;
}) {
  const [open, setOpen] = useState(true);
  const clientes = searchClientes(checklist.cliente, 8);

  return (
    <div
      className="rounded-lg"
      style={{ background: "#0D0D0D", borderLeft: "2px solid #38BDF8", border: "1px solid #1E1E1E" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-bold uppercase flex items-center gap-2" style={{ color: "#38BDF8" }}>
          <Zap size={14} /> Dados do serviço
        </span>
        <ChevronDown
          size={18}
          style={{
            color: "#A0A0A0",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s",
          }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <datalist id="cl-clientes">
            {clientes.map((c) => (
              <option key={c.nome + c.telefone} value={c.nome} />
            ))}
          </datalist>

          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Nome do cliente"
              value={checklist.cliente}
              onChange={(v) => {
                onPatch("cliente", v);
                const found = searchClientes(v, 1)[0];
                if (found && found.nome.toLowerCase() === v.toLowerCase()) {
                  onPatch("telefone", found.telefone);
                }
              }}
              list="cl-clientes"
              placeholder="Buscar ou digitar..."
            />
            <FieldInput
              label="Telefone"
              value={checklist.telefone || ""}
              onChange={(v) => onPatch("telefone", v)}
              placeholder="(11) 99999-9999"
            />
          </div>

          <FieldInput
            label="Endereço do serviço"
            value={checklist.placa}
            onChange={(v) => onPatch("placa", v)}
            placeholder="Rua, número, bairro, cidade"
          />

          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Equipamento"
              value={checklist.modelo}
              onChange={(v) => onPatch("modelo", v)}
              placeholder="Ex: Split Inverter 12.000 BTUs"
            />
            <FieldInput
              label="Marca / Modelo"
              value={checklist.km}
              onChange={(v) => onPatch("km", v)}
              placeholder="Ex: LG Dual Inverter"
            />
          </div>

          <FieldInput
            label="Número da OS"
            value={checklist.os}
            onChange={() => {}}
            readOnly
          />

          <div>
            <div
              className="flex items-center justify-between text-[10px] uppercase font-bold"
              style={{ color: "#A0A0A0" }}
            >
              <span>Complexidade do serviço</span>
              <span>{checklist.combustivel}%</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold" style={{ color: "#A0A0A0" }}>BAIXA</span>
              <input
                type="range"
                min={0}
                max={100}
                value={checklist.combustivel}
                onChange={(e) => onPatch("combustivel", Number(e.target.value))}
                className="flex-1 accent-[#38BDF8]"
              />
              <span className="text-[10px] font-bold" style={{ color: "#38BDF8" }}>ALTA</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PontosAtencaoCard({
  avarias,
  onAdd,
  onUpdate,
  onRemove,
}: {
  avarias: Avaria[];
  onAdd: () => void;
  onUpdate: (id: string, desc: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "#0D0D0D", border: "1px solid #1E1E1E" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase flex items-center gap-2" style={{ color: "#38BDF8" }}>
          <AlertTriangle size={14} /> Pontos de atenção
        </span>
        <button
          onClick={onAdd}
          className="text-[11px] font-bold uppercase px-2 py-1 rounded"
          style={{ background: "transparent", color: "#38BDF8", border: "1px solid #38BDF8" }}
        >
          + Adicionar
        </button>
      </div>
      {avarias.length === 0 ? (
        <p className="text-[11px]" style={{ color: "#A0A0A0" }}>
          Registre defeitos, riscos e reparos necessários (ex: vazamento de gás na conexão, dreno entupido, suporte enferrujado).
        </p>
      ) : (
        <ul className="space-y-2">
          {avarias.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2">
              <span
                className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white"
                style={{ background: "#FF4444" }}
              >
                {i + 1}
              </span>
              <input
                value={a.desc}
                onChange={(e) => onUpdate(a.id, e.target.value)}
                placeholder="Descrever ponto de atenção..."
                className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
                style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#FFF" }}
              />
              <button
                onClick={() => onRemove(a.id)}
                className="p-1.5 rounded-md"
                style={{ background: "#1A0000", border: "1px solid #FF4444" }}
                aria-label="Remover"
              >
                <Trash2 size={14} style={{ color: "#FF4444" }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function FotosBlock({
  fotos,
  onAdd,
  onRemove,
}: {
  fotos: { id: string; dataUrl: string }[];
  onAdd: (f: { id: string; dataUrl: string }[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr: { id: string; dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      arr.push({ id: uid(), dataUrl: data });
    }
    onAdd(arr);
  }

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full py-3 rounded-md flex items-center justify-center gap-2 text-sm font-bold"
        style={{
          background: "#0D0D0D",
          border: "1.5px dashed #38BDF8",
          color: "#38BDF8",
        }}
      >
        <Camera size={16} /> Adicionar Fotos
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="relative rounded-md overflow-hidden aspect-square"
              style={{ background: "#0D0D0D", border: "1px solid #1E1E1E" }}
            >
              <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(f.id)}
                className="absolute top-1 right-1 p-1 rounded-md"
                style={{ background: "rgba(0,0,0,.6)" }}
                aria-label="Remover foto"
              >
                <Trash2 size={14} style={{ color: "#FF4444" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssinaturaModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = getPos(e);
    if (!ctx || !last.current) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }
  function end() {
    drawing.current = false;
    last.current = null;
  }
  function limpar() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  }
  function confirmar() {
    const c = canvasRef.current;
    if (!c) return;
    onConfirm(hasInk ? c.toDataURL("image/png") : undefined as unknown as string);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(0,0,0,.75)" }}
    >
      <div
        className="w-full max-w-md rounded-lg p-4"
        style={{ background: "#0D0D0D", border: "2px solid #38BDF8" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold uppercase">Assinatura do Cliente</h3>
          <button onClick={onClose} aria-label="Fechar">
            <X size={20} style={{ color: "#A0A0A0" }} />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={240}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full rounded-md touch-none"
          style={{ background: "#000000", border: "1px solid #1E1E1E", height: 200 }}
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={limpar}
            className="py-2.5 rounded-md text-sm font-bold uppercase"
            style={{ background: "transparent", color: "#A0A0A0", border: "1px solid #1E1E1E" }}
          >
            Limpar
          </button>
          <button
            onClick={confirmar}
            className="py-2.5 rounded-md text-sm font-bold uppercase"
            style={{ background: "#38BDF8", color: "#000000" }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoricoView({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (c: Checklist, readOnly?: boolean) => void;
}) {
  const [items, setItems] = useState<Checklist[]>(() => listChecklists());
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Checklist | null>(null);
  const [pdfTarget, setPdfTarget] = useState<Checklist | null>(null);

  function remove(id: string) {
    deleteChecklist(id);
    setItems(listChecklists());
    toast.success("Checklist removido.");
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!term) return sorted;
    return sorted.filter(
      (c) =>
        c.cliente.toLowerCase().includes(term) ||
        c.placa.toLowerCase().includes(term) ||
        new Date(c.createdAt).toLocaleString("pt-BR").toLowerCase().includes(term),
    );
  }, [items, q]);

  function countProblemas(c: Checklist) {
    return Object.values(c.itens).filter((i) => i.problema).length;
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#000000", color: "#FFF" }}>
      <header
        className="sticky top-0 z-30 px-4 py-3"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #38BDF8" }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={22} style={{ color: "#38BDF8" }} />
            <h1 className="font-bold uppercase">Histórico de Checklists</h1>
          </div>
          <button
            onClick={onBack}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#38BDF8" }}
          >
            Voltar
          </button>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        {/* Busca */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "#A0A0A0" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, endereço ou data..."
            className="w-full pl-9 pr-3 py-2.5 rounded-md text-sm outline-none"
            style={{
              background: "#000000",
              border: "1px solid #1E1E1E",
              color: "#FFFFFF",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "1px solid #38BDF8")}
            onBlur={(e) => (e.currentTarget.style.border = "1px solid #1E1E1E")}
          />
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: "#A0A0A0" }}>
            {items.length === 0
              ? "Nenhum checklist salvo ainda."
              : "Nenhum resultado para essa busca."}
          </p>
        )}
        {filtered.map((c) => {
          const probs = countProblemas(c);
          return (
          <div
            key={c.id}
            className="rounded-lg p-3 flex items-center justify-between gap-3"
            style={{
              background: "#0D0D0D",
              border: "1px solid #1E1E1E",
              borderLeft: "2px solid #38BDF8",
            }}
          >
            <div className="min-w-0">
              <div className="font-bold truncate" style={{ color: "#FFFFFF" }}>
                {c.cliente || "Sem cliente"}{" "}
                <span style={{ color: "#A0A0A0" }}>· {c.placa || "—"}</span>
              </div>
              <div className="text-xs" style={{ color: "#A0A0A0" }}>
                {c.modelo || "—"} {c.km ? `· ${c.km}` : ""}
              </div>
              <div className="text-xs" style={{ color: "#A0A0A0" }}>
                {new Date(c.createdAt).toLocaleString("pt-BR")} · OS {c.os}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                  style={{
                    background: c.fase === "entrada" ? "#0F2A4A" : "#0F3D1F",
                    color: c.fase === "entrada" ? "#4A90D9" : "#4CAF50",
                    border:
                      "1px solid " + (c.fase === "entrada" ? "#4A90D9" : "#4CAF50"),
                  }}
                >
                  {c.fase === "entrada" ? "ENTRADA" : "SAÍDA"}
                </span>
                {probs > 0 && (
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                    style={{
                      background: "#2A0000",
                      color: "#FF4444",
                      border: "1px solid #FF4444",
                    }}
                  >
                    ⚠ {probs} item{probs === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setViewing(c)}
                className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-md flex items-center gap-1 justify-center"
                style={{ background: "#38BDF8", color: "#000000" }}
              >
                <Eye size={12} /> Ver
              </button>
              <button
                onClick={() => setPdfTarget(c)}
                className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-md flex items-center gap-1 justify-center"
                style={{
                  background: "transparent",
                  color: "#38BDF8",
                  border: "1px solid #38BDF8",
                }}
              >
                <FileDown size={12} /> PDF
              </button>
              <button
                onClick={() => remove(c.id)}
                className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-md"
                style={{
                  background: "transparent",
                  color: "#FF4444",
                  border: "1px solid #FF4444",
                }}
              >
                Excluir
              </button>
            </div>
          </div>
          );
        })}
      </div>
      {viewing && (
        <ChecklistViewerModal
          checklist={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const c = viewing;
            setViewing(null);
            onOpen(c, false);
          }}
          onPdf={(c) => setPdfTarget(c)}
        />
      )}
      {pdfTarget && (
        <PdfCustomizeModal
          checklist={pdfTarget}
          onClose={() => setPdfTarget(null)}
        />
      )}
      <BottomNav />
    </div>
  );
}

// ============ Viewer Modal (read-only) ============
function ChecklistViewerModal({
  checklist,
  onClose,
  onEdit,
  onPdf,
}: {
  checklist: Checklist;
  onClose: () => void;
  onEdit: () => void;
  onPdf: (c: Checklist) => void;
}) {
  const secoes = getSecoes(checklist.tipo);
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "rgba(0,0,0,.85)" }}
      onClick={onClose}
    >
      <div className="min-h-full p-4 grid place-items-start">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-lg p-4 space-y-3"
          style={{ background: "#0D0D0D", border: "2px solid #38BDF8", color: "#FFF" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold uppercase text-sm" style={{ color: "#38BDF8" }}>
              Checklist {checklist.fase === "entrada" ? "ENTRADA" : "SAÍDA"} · OS {checklist.os}
            </h3>
            <button onClick={onClose}>
              <X size={20} style={{ color: "#A0A0A0" }} />
            </button>
          </div>
          <div className="text-xs space-y-1" style={{ color: "#A0A0A0" }}>
            <div>
              <b style={{ color: "#FFF" }}>{checklist.cliente || "—"}</b> · {checklist.telefone || ""}
            </div>
            <div>
              {checklist.placa || "—"} · {checklist.modelo || "—"} · {checklist.km || "—"}

            </div>
            <div>{new Date(checklist.createdAt).toLocaleString("pt-BR")}</div>
          </div>
          {secoes.map((sec) => {
            const itens = sec.itens
              .map((txt, idx) => ({ txt, st: checklist.itens[itemKey(sec.id, idx)] }))
              .filter((i) => i.st?.checked || i.st?.problema);
            if (itens.length === 0) return null;
            return (
              <div key={sec.id} className="text-xs">
                <div className="font-bold uppercase mb-1" style={{ color: "#38BDF8" }}>
                  {sec.titulo}
                </div>
                <ul className="space-y-0.5">
                  {itens.map((i, k) => (
                    <li key={k} className="flex items-center gap-2">
                      {i.st?.problema ? (
                        <AlertTriangle size={12} style={{ color: "#FF4444" }} />
                      ) : (
                        <Check size={12} style={{ color: "#38BDF8" }} />
                      )}
                      <span style={{ color: i.st?.problema ? "#FF8080" : "#FFF" }}>{i.txt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {checklist.observacoes && (
            <div className="text-xs">
              <div className="font-bold uppercase mb-1" style={{ color: "#38BDF8" }}>
                Observações
              </div>
              <p style={{ color: "#FFF", whiteSpace: "pre-wrap" }}>{checklist.observacoes}</p>
            </div>
          )}
          {checklist.fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {checklist.fotos.map((f) => (
                <img
                  key={f.id}
                  src={f.dataUrl}
                  alt=""
                  className="w-full aspect-square object-cover rounded"
                />
              ))}
            </div>
          )}
          {checklist.assinaturaDataUrl && (
            <div>
              <div
                className="text-[10px] font-bold uppercase mb-1"
                style={{ color: "#A0A0A0" }}
              >
                Assinatura
              </div>
              <img
                src={checklist.assinaturaDataUrl}
                alt="assinatura"
                className="w-full rounded"
                style={{ background: "#000000", border: "1px solid #1E1E1E" }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={onEdit}
              className="py-2.5 rounded-md text-xs font-bold uppercase"
              style={{ background: "transparent", color: "#38BDF8", border: "1px solid #38BDF8" }}
            >
              Abrir no editor
            </button>
            <button
              onClick={() => onPdf(checklist)}
              className="py-2.5 rounded-md text-xs font-bold uppercase flex items-center justify-center gap-2"
              style={{ background: "#38BDF8", color: "#000000" }}
            >
              <FileDown size={14} /> Baixar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PDF generator ============
function gerarChecklistPDF(c: Checklist) {
  try {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;
    doc.setFillColor(13, 13, 13);
    doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(255, 215, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CHECKLIST DE INSPEÇÃO", 10, 13);
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${c.fase === "entrada" ? "ENTRADA" : "SAÍDA"} · OS ${c.os}`, 10, 18);
    y = 30;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const linhas = [
      `Cliente: ${c.cliente || "—"}    Telefone: ${c.telefone || "—"}`,
      `Endereço: ${c.placa || "—"}    Equipamento: ${c.modelo || "—"}    Marca: ${c.km || "—"}`,
      `Data: ${new Date(c.createdAt).toLocaleString("pt-BR")}`,
    ];
    linhas.forEach((l) => {
      doc.text(l, 10, y);
      y += 6;
    });
    y += 2;
    const secoes = getSecoes(c.tipo);
    for (const sec of secoes) {
      const itens = sec.itens
        .map((txt, idx) => ({ txt, st: c.itens[itemKey(sec.id, idx)] }))
        .filter((i) => i.st?.checked || i.st?.problema);
      if (!itens.length) continue;
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(180, 140, 0);
      doc.text(sec.titulo.toUpperCase(), 10, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      for (const it of itens) {
        if (y > 280) {
          doc.addPage();
          y = 15;
        }
        const prefix = it.st?.problema ? "[!] " : "[X] ";
        doc.text(`${prefix}${it.txt}`, 12, y);
        y += 5;
      }
      y += 2;
    }
    if (c.observacoes) {
      if (y > 250) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("OBSERVAÇÕES", 10, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const splitted = doc.splitTextToSize(c.observacoes, W - 20);
      doc.text(splitted, 10, y);
      y += splitted.length * 5 + 4;
    }
    if (c.assinaturaDataUrl) {
      if (y > 220) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Assinatura do cliente:", 10, y);
      y += 4;
      try {
        doc.addImage(c.assinaturaDataUrl, "PNG", 10, y, 80, 30);
        y += 34;
      } catch {
        // ignore
      }
    }
    doc.save(`checklist-${c.os}.pdf`);
  } catch (err) {
    console.error(err);
    toast.error("Falha ao gerar PDF");
  }
}

// ============ Modal Personalizar PDF ============
function PdfCustomizeModal({
  checklist,
  onClose,
}: {
  checklist: Checklist;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<OficinaConfig>(() => loadOficina());
  const [opt, setOpt] = useState<PdfOptions>(() => loadPdfOptions());
  const [savedHint, setSavedHint] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  function patchCfg<K extends keyof OficinaConfig>(k: K, v: OficinaConfig[K]) {
    setCfg((c) => {
      const next = { ...c, [k]: v };
      saveOficina(next);
      setSavedHint(true);
      return next;
    });
  }
  function patchOpt<K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) {
    setOpt((o) => {
      const next = { ...o, [k]: v };
      savePdfOptions(next);
      return next;
    });
  }

  async function pickLogo(file: File | null) {
    if (!file) return;
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    patchCfg("logoDataUrl", dataUrl);
  }

  function gerar() {
    if (!cfg.nome.trim()) {
      toast.error("Informe o nome da oficina.");
      return;
    }
    saveOficina(cfg);
    savePdfOptions(opt);
    try {
      gerarChecklistPdfPro(checklist, cfg, opt);
      toast.success("✓ PDF gerado com sucesso!", {
        duration: 3000,
        style: {
          background: "#38BDF8",
          color: "#000000",
          border: "1px solid #38BDF8",
          fontWeight: 700,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar PDF");
    }
  }

  function Toggle({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <button
        onClick={() => onChange(!checked)}
        className="w-full flex items-center justify-between py-2.5 px-3 rounded-md"
        style={{ background: "#000000", border: "1px solid #1E1E1E" }}
      >
        <span className="text-sm" style={{ color: "#FFF" }}>{label}</span>
        <span
          className="w-9 h-5 rounded-full relative transition-colors"
          style={{ background: checked ? "#38BDF8" : "#1E1E1E" }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
            style={{
              background: checked ? "#000000" : "#FFF",
              left: checked ? "18px" : "2px",
            }}
          />
        </span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,.75)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
        style={{
          background: "#0D0D0D",
          borderTop: "2px solid #38BDF8",
          border: "1px solid #1E1E1E",
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E1E" }}>
          <div className="flex items-center gap-2">
            <FileText size={20} style={{ color: "#38BDF8" }} />
            <div>
              <h3 className="font-bold uppercase text-sm" style={{ color: "#FFF" }}>
                Personalizar PDF
              </h3>
              <p className="text-[11px]" style={{ color: "#A0A0A0" }}>
                Essas informações aparecem no cabeçalho do documento
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <X size={20} style={{ color: "#A0A0A0" }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* Logo */}
          <div>
            <label className="text-[11px] uppercase font-bold" style={{ color: "#A0A0A0" }}>
              Logo da loja
            </label>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="w-20 h-20 rounded-md grid place-items-center overflow-hidden"
                style={{
                  background: "#000000",
                  border: "1.5px dashed #38BDF8",
                }}
              >
                {cfg.logoDataUrl ? (
                  <img src={cfg.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <Camera size={20} style={{ color: "#38BDF8" }} />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <button
                  onClick={() => logoInput.current?.click()}
                  className="w-full py-2 rounded-md text-xs font-bold uppercase flex items-center justify-center gap-2"
                  style={{ background: "#000000", color: "#38BDF8", border: "1px solid #38BDF8" }}
                >
                  <Camera size={14} /> {cfg.logoDataUrl ? "Trocar logo" : "Adicionar logo"}
                </button>
                {cfg.logoDataUrl && (
                  <button
                    onClick={() => patchCfg("logoDataUrl", undefined)}
                    className="w-full py-1.5 rounded-md text-[10px] uppercase"
                    style={{ background: "transparent", color: "#A0A0A0", border: "1px solid #1E1E1E" }}
                  >
                    Remover
                  </button>
                )}
                <p className="text-[10px]" style={{ color: "#A0A0A0" }}>
                  Recomendado 300x300px
                </p>
              </div>
            </div>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Dados */}
          <FieldInput
            label="Nome *"
            value={cfg.nome}
            onChange={(v) => patchCfg("nome", v)}
            placeholder="Ex: Auto Mecânica Silva"
          />
          <FieldInput
            label="Endereço"
            value={cfg.endereco}
            onChange={(v) => patchCfg("endereco", v)}
            placeholder="Rua, número, bairro, cidade"
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Telefone"
              value={cfg.telefone}
              onChange={(v) => patchCfg("telefone", v)}
              placeholder="(11) 99999-9999"
            />
            <FieldInput
              label="CNPJ (opcional)"
              value={cfg.cnpj}
              onChange={(v) => patchCfg("cnpj", v)}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <FieldInput
            label="Slogan / Especialidade (opcional)"
            value={cfg.slogan}
            onChange={(v) => patchCfg("slogan", v)}
            placeholder="Ex: Especialista em motores Diesel"
          />
          {savedHint && (
            <p className="text-[11px]" style={{ color: "#4CAF50" }}>
              ✓ Dados salvos automaticamente
            </p>
          )}

          {/* Opções do PDF */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] uppercase font-bold" style={{ color: "#A0A0A0" }}>
              Opções do PDF
            </span>
            <Toggle
              label="Mostrar assinatura do cliente"
              checked={opt.showAssinatura}
              onChange={(v) => patchOpt("showAssinatura", v)}
            />
            <Toggle
              label="Mostrar observações"
              checked={opt.showObservacoes}
              onChange={(v) => patchOpt("showObservacoes", v)}
            />
            <Toggle
              label="Mostrar itens não verificados"
              checked={opt.showNaoVerificados}
              onChange={(v) => patchOpt("showNaoVerificados", v)}
            />
            <Toggle
              label="Mostrar apenas itens com problema"
              checked={opt.apenasProblemas}
              onChange={(v) => patchOpt("apenasProblemas", v)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 grid grid-cols-2 gap-2" style={{ borderTop: "1px solid #1E1E1E" }}>
          <button
            onClick={onClose}
            className="py-3 rounded-md text-sm font-bold uppercase"
            style={{ background: "transparent", color: "#A0A0A0", border: "1px solid #1E1E1E" }}
          >
            Cancelar
          </button>
          <button
            onClick={gerar}
            className="py-3 rounded-md text-sm font-bold uppercase flex items-center justify-center gap-2"
            style={{ background: "#38BDF8", color: "#000000" }}
          >
            <FileDown size={16} /> Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}