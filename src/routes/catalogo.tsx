import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, Plus, Pencil, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/parts";
import {
  deletePeca,
  deleteServico,
  listPecas,
  listServicos,
  setPick,
  upsertPeca,
  upsertServico,
  type CatalogoPeca,
  type CatalogoServico,
  type CatalogoUnidade,
} from "@/lib/catalogo";

export const Route = createFileRoute("/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo — OrçaAr Condicionado Pro" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    pick: s.pick === "true" || s.pick === true,
  }),
  component: CatalogoPage,
});

type Tab = "pecas" | "servicos";
const UNIDADES: CatalogoUnidade[] = ["un", "par", "kit", "jogo", "hora", "m"];

function CatalogoPage() {
  const navigate = useNavigate();
  const { pick: pickMode } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("pecas");
  const [pecas, setPecas] = useState<CatalogoPeca[]>([]);
  const [servicos, setServicos] = useState<CatalogoServico[]>([]);
  const [editing, setEditing] =
    useState<{ kind: Tab; item: CatalogoPeca | CatalogoServico | null } | null>(null);

  useEffect(() => {
    setPecas(listPecas());
    setServicos(listServicos());
  }, []);

  const refresh = () => {
    setPecas(listPecas());
    setServicos(listServicos());
  };

  const onAdd = (kind: Tab) => setEditing({ kind, item: null });

  const onPick = (kind: Tab, item: CatalogoPeca | CatalogoServico) => {
    setPick(kind === "pecas"
      ? { kind: "peca", item: item as CatalogoPeca }
      : { kind: "servico", item: item as CatalogoServico });
    toast.success(`${kind === "pecas" ? "Peça" : "Serviço"} adicionado ao orçamento`);
    navigate({ to: "/novo" });
  };

  const items = tab === "pecas" ? pecas : servicos;

  return (
    <main className="min-h-screen pb-32" style={{ background: "#000000", color: "#fff" }}>
      <header
        className="sticky top-0 z-30 px-4 py-4 flex items-center gap-3"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #38BDF8" }}
      >
        <Link
          to="/novo"
          aria-label="Voltar"
          className="grid place-items-center size-10 rounded-xl"
          style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#38BDF8" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <Package size={22} style={{ color: "#38BDF8" }} />
        <div className="min-w-0">
          <h1 className="font-bold text-base tracking-wide leading-none">
            CATÁLOGO DE PEÇAS E SERVIÇOS
          </h1>
          {pickMode && (
            <p className="text-[11px] mt-1" style={{ color: "#38BDF8" }}>
              Toque em “＋ Adicionar” para enviar ao orçamento
            </p>
          )}
        </div>
      </header>

      {/* Abas */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {(["pecas", "servicos"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="py-2.5 rounded-lg font-bold text-sm tracking-wide transition"
                style={{
                  background: active ? "#38BDF8" : "#0D0D0D",
                  color: active ? "#000000" : "#A0A0A0",
                }}
              >
                {t === "pecas" ? "PEÇAS" : "SERVIÇOS"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <section className="px-4 pt-4 space-y-2.5">
        {items.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-sm"
            style={{ background: "#0D0D0D", color: "#888" }}
          >
            Nenhum {tab === "pecas" ? "peça" : "serviço"} cadastrado ainda.
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="rounded-lg p-3.5"
              style={{ background: "#0D0D0D", borderLeft: "2px solid #38BDF8" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-[15px] truncate">{it.nome}</p>
                  {it.descricao && (
                    <p className="text-xs mt-1 leading-snug" style={{ color: "#A0A0A0" }}>
                      {it.descricao}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold" style={{ color: "#38BDF8" }}>{brl(it.preco)}</p>
                  <p className="text-[10px]" style={{ color: "#666" }}>/{it.unidade}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setEditing({ kind: tab, item: it })}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md"
                  style={{ color: "#A0A0A0", background: "#000000" }}
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  onClick={() => onPick(tab, it)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-md"
                  style={{ background: "#38BDF8", color: "#000000" }}
                >
                  <Plus size={12} strokeWidth={3} /> Adicionar ao orçamento
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Excluir este item?")) return;
                    if (tab === "pecas") deletePeca(it.id);
                    else deleteServico(it.id);
                    refresh();
                    toast.success("Item excluído");
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md"
                  style={{ color: "#FF4444", background: "#000000" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => onAdd(tab)}
        className="fixed bottom-6 right-5 z-40 flex items-center gap-2 font-bold text-sm px-5 py-3.5 rounded-full shadow-2xl active:scale-95 transition"
        style={{ background: "#38BDF8", color: "#000000" }}
      >
        {tab === "pecas" ? <Package size={16} /> : <Wrench size={16} />}
        <Plus size={14} strokeWidth={3} /> Nova {tab === "pecas" ? "Peça" : "Serviço"}
      </button>

      {editing && (
        <CatalogoModal
          kind={editing.kind}
          initial={editing.item}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function CatalogoModal({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: Tab;
  initial: CatalogoPeca | CatalogoServico | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [preco, setPreco] = useState(String(initial?.preco ?? 0));
  const [unidade, setUnidade] = useState<CatalogoUnidade>(
    (initial?.unidade as CatalogoUnidade) ?? (kind === "pecas" ? "un" : "hora"),
  );

  const salvar = () => {
    if (!nome.trim()) return toast.error("Informe o nome.");
    if (!descricao.trim()) return toast.error("Descrição obrigatória por exigência legal.");
    const item = {
      id: initial?.id ?? crypto.randomUUID(),
      nome: nome.trim(),
      descricao: descricao.trim(),
      preco: +preco || 0,
      unidade,
    };
    if (kind === "pecas") upsertPeca(item);
    else upsertServico(item);
    toast.success("Salvo ✓");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="w-full max-w-md rounded-2xl p-5"
        style={{ background: "#0D0D0D", border: "1px solid #1E1E1E", borderTop: "2px solid #38BDF8" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg">
            {initial ? "Editar" : "Nova"} {kind === "pecas" ? "Peça" : "Serviço"}
          </h3>
          <button onClick={onClose} className="text-white"><X size={18} /></button>
        </div>
        <label className="block mb-3">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: "#A0A0A0" }}>Nome *</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
            placeholder={kind === "pecas" ? "Ex: Pastilha de freio dianteira" : "Ex: Troca de óleo"}
          />
        </label>
        <label className="block mb-3">
          <span className="text-[11px] uppercase tracking-wider" style={{ color: "#A0A0A0" }}>Descrição detalhada *</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2.5 rounded-lg outline-none resize-none"
            style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
            placeholder="Ex: Pastilha de freio dianteira cerâmica marca Bosch — referência 0986424723"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: "#A0A0A0" }}>Preço (R$)</span>
            <input
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg outline-none"
              style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: "#A0A0A0" }}>Unidade</span>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as CatalogoUnidade)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg outline-none"
              style={{ background: "#000000", border: "1px solid #1E1E1E", color: "#fff" }}
            >
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: "transparent", border: "1px solid #1E1E1E", color: "#A0A0A0" }}>
            Cancelar
          </button>
          <button onClick={salvar}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: "#38BDF8", color: "#000000" }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// keep linter happy
void useMemo;