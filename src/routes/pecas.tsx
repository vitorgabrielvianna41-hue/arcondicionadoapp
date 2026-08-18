import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Search, Plus, Truck, Pencil, Trash2, X, Package,
  Zap, Cable, Box, Plug, ToggleRight, Wrench, Snowflake,
} from "lucide-react";
import {
  CATEGORIAS, calcVenda, deletePeca, listPecas, savePeca,
  type Peca, type PecaCategoria,
} from "@/lib/pecas";

export const Route = createFileRoute("/pecas")({
  head: () => ({ meta: [{ title: "Materiais — OrçaAr Condicionado Pro" }] }),
  component: PecasPage,
});

const YELLOW = "#38BDF8";

const CAT_ICONS: Record<PecaCategoria, React.ComponentType<{ size?: number; className?: string }>> = {
  "Tubulação e Isolamento": Cable,
  "Elétrica": Zap,
  "Suportes e Fixação": Wrench,
  "Dreno": Box,
  "Gás e Refrigeração": Snowflake,
  "Componentes": Plug,
  "Acessórios": ToggleRight,
  "Outros": Package,
};


const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)) as string;

type FilterCat = PecaCategoria | "Todas";

function PecasPage() {
  const [items, setItems] = useState<Peca[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterCat>("Todas");
  const [editing, setEditing] = useState<Peca | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setItems(listPecas());
  }, []);

  const reload = () => setItems(listPecas());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (filter !== "Todas" && p.categoria !== filter) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.fornecedor.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        (p.codigo ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (p: Peca) => {
    setEditing(p);
    setOpen(true);
  };

  const onDelete = (p: Peca) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    deletePeca(p.id);
    reload();
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white pb-24">
      <header className="px-5 pt-6 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-wider uppercase">
            Materiais
          </h1>
          <p className="text-sm text-[#A0A0A0] mt-1">Seu catálogo de materiais</p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-1.5 bg-[#38BDF8] text-black font-bold text-sm rounded-xl px-3 py-2.5 hover:brightness-95 transition shadow-[0_6px_20px_-8px_rgba(255,208,0,0.6)]"
        >
          <Plus size={16} strokeWidth={3} />
          Novo Material
        </button>
      </header>

      <div className="px-5">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar material, fornecedor ou categoria..."
            className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-[#777] outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition"
          />
        </div>
      </div>

      <div className="mt-4 px-5">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {(["Todas", ...CATEGORIAS] as FilterCat[]).map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition ${
                  active
                    ? "bg-[#38BDF8] text-black border-[#38BDF8]"
                    : "bg-transparent text-[#A0A0A0] border-[#1E1E1E] hover:text-white"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-5 mt-3 space-y-3">
        {filtered.length === 0 ? (
          items.length === 0 ? (
            <EmptyState onAdd={openNew} />
          ) : (
            <p className="text-center text-sm text-[#A0A0A0] py-12">
              Nenhum material encontrado para esta busca.
            </p>
          )
        ) : (
          filtered.map((p) => (
            <PecaCard key={p.id} peca={p} onEdit={() => openEdit(p)} onDelete={() => onDelete(p)} />
          ))
        )}
      </main>

      {open && (
        <PecaModal
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PecaCard({
  peca, onEdit, onDelete,
}: { peca: Peca; onEdit: () => void; onDelete: () => void }) {
  const Icon = CAT_ICONS[peca.categoria] ?? Box;
  const margem = peca.custo > 0 ? ((peca.venda - peca.custo) / peca.custo) * 100 : 0;
  const semEstoque = peca.quantidade <= 0;

  return (
    <article className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-4 flex gap-3">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
        <Icon size={24} className="text-[#38BDF8]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-white font-bold truncate">{peca.nome}</h3>
            <p className="text-[11px] text-[#A0A0A0] uppercase tracking-wide">{peca.categoria}</p>
            {peca.fornecedor && (
              <p className="text-xs text-[#A0A0A0] mt-1 flex items-center gap-1.5">
                <Truck size={12} className="text-[#A0A0A0]" />
                <span className="truncate">{peca.fornecedor}</span>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              aria-label="Editar"
              className="p-1.5 rounded-md hover:bg-white/5 text-[#38BDF8]"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onDelete}
              aria-label="Excluir"
              className="p-1.5 rounded-md hover:bg-white/5 text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className={`font-semibold ${semEstoque ? "text-red-500" : "text-green-500"}`}>
            Qtd: {peca.quantidade}
          </span>
          <span className="text-[#A0A0A0]">Custo: {fmtBRL(peca.custo)}</span>
          <span className="text-white font-bold">Venda: {fmtBRL(peca.venda)}</span>
          <span className="text-green-500">Margem: {margem.toFixed(0)}%</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-6 flex flex-col items-center">
      <Package size={64} className="text-[#1E1E1E]" strokeWidth={1.5} />
      <h2 className="text-white font-bold text-lg mt-4">Nenhum material cadastrado ainda</h2>
      <p className="text-sm text-[#A0A0A0] mt-1 max-w-xs">
        Adicione materiais ao seu catálogo para agilizar seus orçamentos
      </p>
      <button
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 bg-[#38BDF8] text-black font-bold rounded-xl px-5 py-3 hover:brightness-95 transition"
      >
        <Plus size={18} strokeWidth={3} />
        Adicionar Primeiro Material
      </button>
    </div>
  );
}

function PecaModal({
  initial, onClose, onSaved,
}: {
  initial: Peca | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [categoria, setCategoria] = useState<PecaCategoria>(initial?.categoria ?? "Tubulação e Isolamento");
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor ?? "");
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const [quantidade, setQuantidade] = useState<string>(String(initial?.quantidade ?? ""));
  const [custo, setCusto] = useState<string>(initial ? String(initial.custo) : "");
  const [margem, setMargem] = useState<string>(initial ? String(initial.margem) : "50");
  const [venda, setVenda] = useState<string>(initial ? String(initial.venda) : "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");

  const custoN = parseFloat(custo.replace(",", ".")) || 0;
  const margemN = parseFloat(margem.replace(",", ".")) || 0;
  const vendaN = parseFloat(venda.replace(",", ".")) || 0;

  // recalcular venda quando custo ou margem mudam
  useEffect(() => {
    if (!custo) return;
    setVenda(String(calcVenda(custoN, margemN)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custo, margem]);

  const lucro = +(vendaN - custoN).toFixed(2);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return alert("Informe o nome do material");
    if (!quantidade) return alert("Informe a quantidade");
    if (!custo) return alert("Informe o valor de custo");

    const peca: Peca = {
      id: initial?.id ?? uid(),
      nome: nome.trim(),
      categoria,
      fornecedor: fornecedor.trim(),
      codigo: codigo.trim() || undefined,
      quantidade: parseInt(quantidade) || 0,
      custo: custoN,
      margem: margemN,
      venda: vendaN,
      observacoes: observacoes.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    savePeca(peca);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#000000] border border-[#1E1E1E] rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#000000] border-b border-[#1E1E1E] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {initial ? "Editar Material" : "Novo Material"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-[#A0A0A0]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Nome do material *">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pastilha de freio dianteira"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria *">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as PecaCategoria)}
                className={inputCls}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Código / Ref.">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Fornecedor">
            <input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex: Bosch, Monroe..."
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Qtd. *">
              <input
                type="number"
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="Custo (R$) *">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder="0,00"
                className={inputCls}
              />
            </Field>
            <Field label="Margem (%) *">
              <input
                type="number"
                step="1"
                inputMode="decimal"
                value={margem}
                onChange={(e) => setMargem(e.target.value)}
                placeholder="50"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Valor de venda (R$)">
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={venda}
              onChange={(e) => setVenda(e.target.value)}
              placeholder="0,00"
              className={inputCls}
            />
          </Field>

          <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-3 space-y-1">
            <p className="text-sm">
              <span className="text-[#A0A0A0]">Valor de Venda: </span>
              <span className="text-[#38BDF8] font-bold">{fmtBRL(vendaN)}</span>
            </p>
            <p className="text-sm">
              <span className="text-[#A0A0A0]">Lucro por unidade: </span>
              <span className="text-green-500 font-bold">{fmtBRL(lucro)}</span>
            </p>
          </div>

          <Field label="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Opcional"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            className="w-full bg-[#38BDF8] text-black font-bold py-3.5 rounded-xl hover:brightness-95 transition uppercase tracking-wider"
          >
            Salvar Material
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-[#111111] border border-[#1E1E1E] text-white placeholder:text-[#666] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#38BDF8] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}