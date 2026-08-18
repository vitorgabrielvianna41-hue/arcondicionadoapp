import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  User,
  Wrench,
  Snowflake,
  MapPin,
  Cog,
  Calculator,
  ChevronDown,
  Plus,
  Trash2,
  Save,
  Package,
  Search,
  UserPlus,
} from "lucide-react";
import { VozOrcamentoModal, type VozDados } from "@/components/VozOrcamentoModal";

import { PART_LABELS, brl, unitFor } from "@/lib/parts";
import {
  findVehicleByPlaca,
  getOrcamento,
  getSettings,
  saveOrcamento,
  searchClientes,
  type Cliente,
  type LinePart,
  type Orcamento,
  type RegistroFoto,
  type TecnicoInfo,
} from "@/lib/storage";

import { toast } from "sonner";
import { consumePick } from "@/lib/catalogo";
import { gerarNumeroOS } from "@/lib/checklist-storage";
import { compressImage, MAX_FOTOS } from "@/lib/foto";

const TIPOS_SERVICO = [
  "Instalação de Split",
  "Instalação de Split Inverter",
  "Instalação de Multi Split",
  "Instalação de Ar de Janela",
  "Manutenção Preventiva",
  "Manutenção Corretiva",
  "Higienização / Limpeza",
  "Recarga de Gás",
  "Desinstalação",
  "Desinstalação + Reinstalação",
  "Reparo de Vazamento",
  "Troca de Peças",
];

const TIPOS_EQUIPAMENTO = [
  "Split Hi Wall",
  "Split Inverter",
  "Multi Split",
  "Janela",
  "Cassete",
  "Piso-Teto",
  "Portátil",
  "Ar Condicionado Central",
];

const CAPACIDADES = [
  "7.000 BTUs",
  "9.000 BTUs",
  "12.000 BTUs",
  "18.000 BTUs",
  "22.000 BTUs",
  "24.000 BTUs",
  "30.000 BTUs",
  "36.000 BTUs",
  "48.000 BTUs",
  "60.000 BTUs",
];

const AMBIENTES = [
  "Quarto",
  "Sala",
  "Cozinha",
  "Escritório",
  "Loja",
  "Sala Comercial",
  "Galpão",
  "Restaurante",
  "Outro",
];

const TIPOS_INSTALACAO = [
  "Parede",
  "Teto",
  "Embutido",
  "Aparente",
  "Com infraestrutura pronta",
  "Sem infraestrutura",
];

export const Route = createFileRoute("/novo")({
  head: () => ({ meta: [{ title: "Novo Orçamento — OrçaAr Condicionado Pro" }] }),
  validateSearch: (s: Record<string, unknown>): { edit?: string } =>
    typeof s.edit === "string" ? { edit: s.edit } : {},

  component: Novo,
});

type Servico = { desc: string; valor: number };
type ServicoEx = { nome: string; desc: string; valor: number };

const DRAFT_KEY = "orc_draft_v1";

function Novo() {
  const navigate = useNavigate();
  const settings = useMemo(() => getSettings(), []);
  const { edit: editId } = Route.useSearch();
  const editing = useMemo(() => (editId ? getOrcamento(editId) : undefined), [editId]);

  // Inicializa o estado a partir do orçamento que está sendo editado, se houver.
  const init = useMemo(() => {
    if (!editing) {
      return {
        cliente: { nome: "", telefone: "", email: "" },
        veiculo: { marca: "", modelo: "", ano: "", placa: "", km: "1" },
        equip: {
          tipoServico: "",
          tipoEquipamento: "",
          ambiente: "",
          tipoInstalacao: "",
        },
        parts: [{ key: "custom", name: "", qty: 1, unit: "un", price: 0 }] as LinePart[],
        servicos: [{ nome: "", desc: "", valor: settings.maoObraHora || 0 }] as ServicoEx[],
        margem: settings.margemPadrao || 50,
        observacoes: "",
      };
    }
    const m = editing.margem || 0;
    const factor = 1 + m / 100;
    // separa linhas especiais das observações livres
    const obsLines = (editing.observacoes || "").split("\n");
    let email = "";
    let km = "";
    let marca = "";
    let modelo = "";
    const equip = { tipoServico: "", tipoEquipamento: "", ambiente: "", tipoInstalacao: "" };
    const servicosDesc: string[] = [];
    const freeObs: string[] = [];
    const take = (ln: string, p: string) => ln.slice(p.length).trim();
    for (const ln of obsLines) {
      if (ln.startsWith("E-mail: ")) email = take(ln, "E-mail: ");
      else if (ln.startsWith("Quantidade: ")) km = take(ln, "Quantidade: ");
      else if (ln.startsWith("Marca: ")) marca = take(ln, "Marca: ");
      else if (ln.startsWith("Modelo: ")) modelo = take(ln, "Modelo: ");
      else if (ln.startsWith("Tipo de serviço: ")) equip.tipoServico = take(ln, "Tipo de serviço: ");
      else if (ln.startsWith("Equipamento: ")) equip.tipoEquipamento = take(ln, "Equipamento: ");
      else if (ln.startsWith("Ambiente: ")) equip.ambiente = take(ln, "Ambiente: ");
      else if (ln.startsWith("Tipo de instalação: "))
        equip.tipoInstalacao = take(ln, "Tipo de instalação: ");
      else if (ln.startsWith("Serviço: ")) servicosDesc.push(take(ln, "Serviço: "));
      else if (ln.trim()) freeObs.push(ln);
    }

    // Restaura serviços: se houver várias descrições, divide o total proporcionalmente
    // entre elas mantendo o último com o ajuste final. Caso só haja uma, atribui tudo.
    const totalMO = editing.totals.maoObra;
    let servicos: ServicoEx[];
    if (editing.servicosDetalhados && editing.servicosDetalhados.length) {
      servicos = editing.servicosDetalhados.map((s) => ({
        nome: s.nome,
        desc: s.descricao,
        valor: s.valor,
      }));
    } else {
      const descricoes = servicosDesc.length ? servicosDesc : [editing.servicoNome || ""];
      servicos = descricoes.length === 1
        ? [{ nome: editing.servicoNome || descricoes[0] || "", desc: descricoes[0] || "", valor: totalMO }]
        : (() => {
            const each = +(totalMO / descricoes.length).toFixed(2);
            const arr = descricoes.map((d) => ({ nome: d, desc: d, valor: each }));
            const diff = +(totalMO - each * descricoes.length).toFixed(2);
            if (arr.length) arr[arr.length - 1].valor = +(arr[arr.length - 1].valor + diff).toFixed(2);
            return arr;
          })();
    }
    return {
      cliente: {
        nome: editing.cliente.nome,
        telefone: editing.cliente.telefone,
        email,
      },
      veiculo: {
        marca,
        modelo,
        ano: editing.veiculo.ano,
        placa: editing.veiculo.placa,
        km: km || "1",
      },
      equip,

      parts: editing.parts.map((p) => ({
        ...p,
        price: +(p.price / factor).toFixed(2),
      })),
      servicos,
      margem: m,
      observacoes: freeObs.join("\n"),
    };
  }, [editing, settings]);

  const [cliente, setCliente] = useState(init.cliente);
  const [veiculo, setVeiculo] = useState(init.veiculo);
  const [equip, setEquip] = useState(init.equip);
  const [parts, setParts] = useState<LinePart[]>(init.parts);
  const [servicos, setServicos] = useState<ServicoEx[]>(init.servicos);
  const [margem, setMargem] = useState(init.margem);
  const [observacoes, setObservacoes] = useState(init.observacoes);
  const [tecnico, setTecnico] = useState<TecnicoInfo>({
    problemaRelatado: editing?.tecnico?.problemaRelatado ?? "",
    diagnostico: editing?.tecnico?.diagnostico ?? "",
    servicoRecomendado: editing?.tecnico?.servicoRecomendado ?? "",
  });
  const [registroDesc, setRegistroDesc] = useState(editing?.registro?.descricao ?? "");
  const [fotos, setFotos] = useState<RegistroFoto[]>(editing?.registro?.fotos ?? []);
  const [desconto, setDesconto] = useState<number>(editing?.desconto ?? 0);
  const [foundVehicle, setFoundVehicle] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  const draftSnapshotRef = useRef<string>("");
  const skipAutosaveRef = useRef(true);
  const numeroOS = useMemo(
    () => editing?.os ?? gerarNumeroOS(),
    [editing],
  );

  // Se editId mudar após mount (ex: vindo de outro orçamento), repõe os estados.
  useEffect(() => {
    setCliente(init.cliente);
    setVeiculo(init.veiculo);
    setEquip(init.equip);
    setParts(init.parts);
    setServicos(init.servicos);
    setMargem(init.margem);
    setObservacoes(init.observacoes);
  }, [init]);

  useEffect(() => {
    if (!editing) return;
    setTecnico({
      problemaRelatado: editing.tecnico?.problemaRelatado ?? "",
      diagnostico: editing.tecnico?.diagnostico ?? "",
      servicoRecomendado: editing.tecnico?.servicoRecomendado ?? "",
    });
    setRegistroDesc(editing.registro?.descricao ?? "");
    setFotos(editing.registro?.fotos ?? []);
    setDesconto(editing.desconto ?? 0);
  }, [editing]);




  // Consome item escolhido no catálogo
  useEffect(() => {
    const pick = consumePick();
    if (!pick) return;
    if (pick.kind === "peca") {
      setParts((arr) => {
        const blank = arr.length === 1 && !arr[0].name.trim();
        const newP: LinePart = {
          key: pick.item.id,
          name: pick.item.nome,
          descricao: pick.item.descricao,
          qty: 1,
          unit: pick.item.unidade,
          price: pick.item.preco,
        };
        return blank ? [newP] : [...arr, newP];
      });
    } else {
      setServicos((arr) => {
        const blank = arr.length === 1 && !arr[0].desc.trim() && !arr[0].nome.trim();
        const newS: ServicoEx = {
          nome: pick.item.nome,
          desc: pick.item.descricao,
          valor: pick.item.preco,
        };
        return blank ? [newS] : [...arr, newS];
      });
    }
  }, []);

  // Detecta rascunho pendente (apenas no modo criação)
  useEffect(() => {
    if (editing) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setShowDraftPrompt(true);
    } catch {}
    // libera autosave após o primeiro tick
    const t = setTimeout(() => { skipAutosaveRef.current = false; }, 300);
    return () => clearTimeout(t);
  }, [editing]);

  // Auto-save com debounce 2s
  useEffect(() => {
    if (editing) return;
    if (skipAutosaveRef.current) return;
    const snapshot = JSON.stringify({ cliente, veiculo, parts, servicos, margem, observacoes, tecnico, registroDesc, desconto });
    if (snapshot === draftSnapshotRef.current) return;
    // só salva se tiver algum conteúdo significativo
    const hasContent =
      cliente.nome.trim() || cliente.telefone.trim() || veiculo.placa.trim() ||
      parts.some((p) => p.name.trim()) || servicos.some((s) => s.nome.trim() || s.desc.trim());
    if (!hasContent) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, snapshot);
        draftSnapshotRef.current = snapshot;
        toast("💾 Salvo automaticamente", {
          duration: 1800,
          position: "bottom-center",
          style: { background: "#0F3D24", color: "#4CAF50", border: "1px solid #4CAF50" },
        });
      } catch {}
    }, 2000);
    return () => clearTimeout(id);
  }, [cliente, veiculo, parts, servicos, margem, observacoes, tecnico, registroDesc, desconto, editing]);

  const continuarRascunho = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { setShowDraftPrompt(false); return; }
      const d = JSON.parse(raw);
      if (d.cliente) setCliente(d.cliente);
      if (d.veiculo) setVeiculo(d.veiculo);
      if (d.parts) setParts(d.parts);
      if (d.servicos) setServicos(d.servicos);
      if (typeof d.margem === "number") setMargem(d.margem);
      if (typeof d.observacoes === "string") setObservacoes(d.observacoes);
      if (d.tecnico) setTecnico(d.tecnico);
      if (typeof d.registroDesc === "string") setRegistroDesc(d.registroDesc);
      if (typeof d.desconto === "number") setDesconto(d.desconto);
    } catch {}
    setShowDraftPrompt(false);
  };

  const descartarRascunho = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setShowDraftPrompt(false);
  };

  const onPlaca = (raw: string) => {
    setVeiculo((v) => ({ ...v, placa: raw }));
  };

  const maoObraTotal = useMemo(
    () => servicos.reduce((s, x) => s + (Number(x.valor) || 0), 0),
    [servicos]
  );

  const totals = useMemo(() => {
    const custoPecas = parts.reduce((s, p) => s + p.price * p.qty, 0);
    const pecasComMargem = custoPecas * (1 + margem / 100);
    const bruto = pecasComMargem + maoObraTotal;
    const desc = Math.max(0, Math.min(Number(desconto) || 0, bruto));
    const total = bruto - desc;
    const lucro = pecasComMargem - custoPecas + maoObraTotal - desc;
    return { custoPecas, pecasComMargem, bruto, desconto: desc, total, lucro };
  }, [parts, margem, maoObraTotal, desconto]);

  // Fotos do Registro do Serviço
  const addFotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const restante = MAX_FOTOS - fotos.length;
    if (restante <= 0) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por orçamento.`);
      return;
    }
    const novas: RegistroFoto[] = [];
    for (const f of Array.from(files).slice(0, restante)) {
      try {
        novas.push({ id: crypto.randomUUID(), dataUrl: await compressImage(f) });
      } catch {
        toast.error(`Não foi possível processar "${f.name}".`);
      }
    }
    if (novas.length) setFotos((arr) => [...arr, ...novas]);
  };
  const removeFoto = (fid: string) => setFotos((arr) => arr.filter((f) => f.id !== fid));
  const setLegenda = (fid: string, legenda: string) =>
    setFotos((arr) => arr.map((f) => (f.id === fid ? { ...f, legenda } : f)));


  const updateServico = (i: number, patch: Partial<ServicoEx>) =>
    setServicos((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addServico = () =>
    setServicos((arr) => [...arr, { nome: "", desc: "", valor: 0 }]);
  const removeServico = (i: number) =>
    setServicos((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const updatePart = (i: number, patch: Partial<LinePart>) => {
    setParts((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const removePart = (i: number) => setParts((arr) => arr.filter((_, idx) => idx !== i));
  const addBlankPart = () =>
    setParts((arr) => [...arr, { key: "custom", name: "", descricao: "", qty: 1, unit: "un", price: 0 }]);
  const addBancoPart = (key: string) => {
    const name = PART_LABELS[key] ?? key;
    const price = settings.prices[key] ?? 0;
    setParts((arr) => [...arr, { key, name, descricao: "", qty: 1, unit: "un", price }]);
  };

  const validar = () => {
    if (!cliente.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return false;
    }
    const vParts = parts.filter((p) => p.name.trim() && p.qty > 0);
    if (vParts.some((p) => !(p.descricao || "").trim())) {
      toast.error("Descrição obrigatória em todas as peças (exigência legal).");
      return false;
    }
    const vServ = servicos.filter((s) => (s.nome || s.desc).trim());
    if (vServ.some((s) => !s.desc.trim())) {
      toast.error("Descrição obrigatória em todos os serviços (exigência legal).");
      return false;
    }
    return true;
  };

  const abrirResumo = () => {
    if (!validar()) return;
    setResumoOpen(true);
  };

  const salvar = () => {
    if (!validar()) return;
    const validParts = parts.filter((p) => p.name.trim() && p.qty > 0);
    const validServ = servicos.filter((s) => (s.nome || s.desc).trim());

    const obsExtras: string[] = [];
    if (cliente.email) obsExtras.push(`E-mail: ${cliente.email}`);
    if (veiculo.km) obsExtras.push(`Quantidade: ${veiculo.km}`);
    if (equip.tipoServico) obsExtras.push(`Tipo de serviço: ${equip.tipoServico}`);
    if (equip.tipoEquipamento) obsExtras.push(`Equipamento: ${equip.tipoEquipamento}`);
    if (veiculo.marca) obsExtras.push(`Marca: ${veiculo.marca}`);
    if (veiculo.modelo) obsExtras.push(`Modelo: ${veiculo.modelo}`);
    if (equip.ambiente) obsExtras.push(`Ambiente: ${equip.ambiente}`);
    if (equip.tipoInstalacao) obsExtras.push(`Tipo de instalação: ${equip.tipoInstalacao}`);
    servicos
      .filter((x) => x.desc.trim())
      .forEach((x) => obsExtras.push(`Serviço: ${x.desc.trim()}`));
    if (observacoes.trim()) obsExtras.push(observacoes.trim());

    const marcaModelo = [equip.tipoEquipamento, veiculo.marca, veiculo.modelo]
      .filter(Boolean)
      .join(" ")
      .trim();
    const primeiroServico = servicos.find((x) => (x.nome || x.desc).trim())
      ? (servicos.find((x) => x.nome.trim())?.nome.trim() ||
         servicos.find((x) => x.desc.trim())?.desc.trim())
      : undefined;

    const o: Orcamento = {
      id: editing?.id ?? crypto.randomUUID(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: editing ? new Date().toISOString() : undefined,
      cliente: { nome: cliente.nome, telefone: cliente.telefone },
      veiculo: { marcaModelo, ano: veiculo.ano, placa: veiculo.placa },
      servicoId: "personalizado",
      servicoNome: primeiroServico || equip.tipoServico || "Orçamento personalizado",
      os: numeroOS,
      motorL: 0,
      cilindros: 0,
      margem,
      maoObra: maoObraTotal,
      parts: validParts.map((p) => ({
        ...p,
        price: +(p.price * (1 + margem / 100)).toFixed(2),
      })),
      servicosDetalhados: validServ.map((s) => ({
        nome: s.nome.trim() || s.desc.trim().slice(0, 60),
        descricao: s.desc.trim(),
        valor: +(+s.valor || 0).toFixed(2),
      })),
      totals: {
        pecas: +totals.pecasComMargem.toFixed(2),
        maoObra: maoObraTotal,
        total: +totals.total.toFixed(2),
        lucro: +totals.lucro.toFixed(2),
      },
      status: editing?.status ?? "enviado",
      observacoes: obsExtras.length ? obsExtras.join("\n") : undefined,
      parcelas: editing?.parcelas ?? 1,
      fotoDataUrl: editing?.fotoDataUrl,
    };
    saveOrcamento(o);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    toast.success(editing ? "Alterações salvas ✓" : "Orçamento criado ✓", { duration: 2000 });
    navigate({ to: "/orcamento/$id", params: { id: o.id } });
  };

  const cancelar = () => {
    if (editing) navigate({ to: "/orcamento/$id", params: { id: editing.id } });
    else navigate({ to: "/" });
  };

  const bancoOptions = Object.entries(PART_LABELS).filter(([k]) => k !== "servico_personalizado");

  // ===== Orçamento por voz =====
  const [vozOpen, setVozOpen] = useState(false);
  const [vozAviso, setVozAviso] = useState(false);
  const [vozIncertos, setVozIncertos] = useState<string[]>([]);

  const aplicarVoz = (d: VozDados) => {
    const c = d.cliente ?? {};
    const s = d.servico ?? {};
    setCliente((cur) => ({
      ...cur,
      nome: c.nome?.trim() || cur.nome,
      telefone: c.telefone?.trim() || cur.telefone,
    }));
    setVeiculo((cur) => ({
      ...cur,
      placa: c.endereco?.trim() || cur.placa,
      ano: CAPACIDADES.includes(s.capacidade ?? "") ? s.capacidade! : cur.ano,
      marca: s.marca?.trim() || cur.marca,
      modelo: s.modelo?.trim() || cur.modelo,
      km: s.quantidade ? String(s.quantidade) : cur.km,
    }));
    setEquip((cur) => ({
      tipoServico: TIPOS_SERVICO.includes(s.tipoServico ?? "") ? s.tipoServico! : cur.tipoServico,
      tipoEquipamento: TIPOS_EQUIPAMENTO.includes(s.tipoEquipamento ?? "")
        ? s.tipoEquipamento!
        : cur.tipoEquipamento,
      ambiente: AMBIENTES.includes(s.ambiente ?? "") ? s.ambiente! : cur.ambiente,
      tipoInstalacao: TIPOS_INSTALACAO.includes(s.tipoInstalacao ?? "")
        ? s.tipoInstalacao!
        : cur.tipoInstalacao,
    }));

    const mats = (d.materiais ?? []).filter((m) => (m.nome || m.key) && m.key !== undefined);
    if (mats.length) {
      const novas: LinePart[] = mats.map((m) => {
        const key = m.key && m.key !== "custom" ? m.key : "custom";
        const name = key !== "custom" ? (PART_LABELS[key] ?? m.nome ?? "") : (m.nome ?? "");
        return {
          key,
          name,
          descricao: `${name}${m.quantidade ? ` — ${m.quantidade} ${m.unidade || unitFor(key)}` : ""} (informado por voz)`,
          qty: Number(m.quantidade) > 0 ? Number(m.quantidade) : 1,
          unit: m.unidade || unitFor(key),
          price: settings.prices[key] ?? 0,
        };
      });
      setParts((arr) => {
        const blank = arr.length === 1 && !arr[0].name.trim();
        return blank ? novas : [...arr, ...novas];
      });
    }

    const servs = (d.servicos ?? []).filter((x) => (x.nome || x.descricao || "").trim());
    if (servs.length) {
      const novos: ServicoEx[] = servs.map((x) => ({
        nome: (x.nome || x.descricao || "").trim().slice(0, 60),
        desc: (x.descricao || x.nome || "").trim(),
        valor: Number(x.valor) || 0,
      }));
      setServicos((arr) => {
        const blank = arr.length === 1 && !arr[0].nome.trim() && !arr[0].desc.trim();
        return blank ? novos : [...arr, ...novos];
      });
    }

    const incertos = (d.camposIncertos ?? []).filter(Boolean);
    setVozIncertos(incertos);
    setVozAviso(true);
    setVozOpen(false);
    toast.success(
      incertos.length
        ? "Alguns dados não foram identificados. Confira os campos destacados."
        : "Dados preenchidos por voz ✓ Confira antes de gerar.",
      { duration: 3000 },
    );
  };


  return (
    <main className="min-h-screen bg-[#000000] text-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#000000]/95 backdrop-blur border-b border-[#1E1E1E]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            to="/"
            aria-label="Voltar"
            className="grid place-items-center size-10 rounded-full bg-[#111111] border border-[#1E1E1E] text-yellow hover:border-yellow/60 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#888]">
              {editing ? "Editando orçamento" : `Nº da OS · ${numeroOS}`}
            </p>
            <h1 className="font-display text-2xl text-white truncate">
              {editing ? "Editar Orçamento" : "Novo Orçamento"}
            </h1>
            <p className="text-xs text-[#888] truncate">
              Monte o orçamento do seu próximo serviço
            </p>
          </div>

          <Link
            to="/catalogo"
            search={{ pick: true }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold tracking-wide"
            style={{ background: "#0D0D0D", color: "#38BDF8", border: "1px solid #38BDF8" }}
          >
            <Package size={14} /> Catálogo
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-5 space-y-3">
        {/* 0. Orçamento por voz */}
        <div className="rounded-2xl border border-yellow/40 bg-[#0D0D0D] p-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow bg-yellow/10 border border-yellow/40 rounded-full px-2 py-0.5">
              ⚡ Mais rápido
            </span>
          </div>
          <p className="mt-2 text-sm text-[#9AA4B2]">
            Fale os dados do serviço e deixe o app montar o orçamento para você.
          </p>
          <button
            type="button"
            onClick={() => setVozOpen(true)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-yellow text-black font-bold uppercase tracking-wide text-sm active:scale-[0.98] transition shadow-[0_10px_30px_-12px_rgba(56,189,248,0.7)]"
          >
            🎙️ Criar orçamento por voz
          </button>
        </div>

        {vozAviso && (
          <div className="rounded-2xl border border-yellow/40 bg-yellow/5 px-4 py-3">
            <p className="text-sm font-semibold text-yellow">
              Confira os dados antes de gerar o orçamento.
            </p>
            {!!vozIncertos.length && (
              <ul className="mt-1.5 text-xs text-amber-300 space-y-0.5">
                {vozIncertos.map((c, i) => (
                  <li key={i}>⚠️ Confira este campo: {c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 1. Cliente */}

        <Section icon={User} title="Dados do Cliente" defaultOpen>
          <Grid cols={2}>
            <Field label="Nome *">
              <ClienteSearchInput
                value={cliente.nome}
                onChange={(v) => setCliente((c) => ({ ...c, nome: v }))}
                onPick={(c) => {
                  setCliente((cur) => ({
                    ...cur,
                    nome: c.nome,
                    telefone: c.telefone || cur.telefone,
                  }));
                  if (c.ultimoVeiculo) {
                    setVeiculo((v) => ({
                      ...v,
                      ano: c.ultimoVeiculo!.ano || v.ano,
                      placa: c.ultimoVeiculo!.placa || v.placa,
                    }));
                  }
                }}
              />
            </Field>
            <Field label="Telefone">
              <Input
                inputMode="tel"
                value={cliente.telefone}
                onChange={(v) => setCliente({ ...cliente, telefone: v })}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field label="E-mail" full>
              <Input
                type="email"
                value={cliente.email}
                onChange={(v) => setCliente({ ...cliente, email: v })}
                placeholder="cliente@email.com"
              />
            </Field>
          </Grid>
        </Section>

        {/* 2. Serviço */}
        <Section icon={Wrench} title="Dados do Serviço" defaultOpen>
          <Grid cols={2}>
            <Field label="Endereço do serviço" full>
              <Input
                value={veiculo.placa}
                onChange={(v) => onPlaca(v)}
                placeholder="Rua, número, bairro, cidade"
              />
            </Field>
            <Field label="Tipo de serviço" full>
              <select
                value={equip.tipoServico}
                onChange={(e) => setEquip({ ...equip, tipoServico: e.target.value })}
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow/60"
              >
                <option value="">Selecione…</option>
                {TIPOS_SERVICO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </Grid>
          {foundVehicle && (
            <p className="mt-3 text-sm text-emerald-400">
              ✓ Cliente e dados preenchidos do histórico.
            </p>
          )}
        </Section>

        {/* 3. Equipamento */}
        <Section icon={Snowflake} title="Dados do Equipamento" defaultOpen>
          <Grid cols={2}>
            <Field label="Tipo de equipamento">
              <select
                value={equip.tipoEquipamento}
                onChange={(e) => setEquip({ ...equip, tipoEquipamento: e.target.value })}
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow/60"
              >
                <option value="">Selecione…</option>
                {TIPOS_EQUIPAMENTO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Capacidade">
              <select
                value={veiculo.ano}
                onChange={(e) => setVeiculo({ ...veiculo, ano: e.target.value })}
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow/60"
              >
                <option value="">Selecione…</option>
                {CAPACIDADES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Marca">
              <Input
                value={veiculo.marca}
                onChange={(v) => setVeiculo({ ...veiculo, marca: v })}
                placeholder="Ex: Midea, LG, Samsung"
              />
            </Field>
            <Field label="Modelo">
              <Input
                value={veiculo.modelo}
                onChange={(v) => setVeiculo({ ...veiculo, modelo: v })}
                placeholder="Ex: Xtreme Save Inverter"
              />
            </Field>
            <Field label="Quantidade de equipamentos">
              <Input
                type="number"
                inputMode="numeric"
                value={veiculo.km}
                onChange={(v) => setVeiculo({ ...veiculo, km: v })}
                placeholder="1"
              />
            </Field>
          </Grid>
        </Section>

        {/* 4. Local do serviço */}
        <Section icon={MapPin} title="Local do Serviço" defaultOpen>
          <Grid cols={2}>
            <Field label="Ambiente">
              <select
                value={equip.ambiente}
                onChange={(e) => setEquip({ ...equip, ambiente: e.target.value })}
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow/60"
              >
                <option value="">Selecione…</option>
                {AMBIENTES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de instalação">
              <select
                value={equip.tipoInstalacao}
                onChange={(e) => setEquip({ ...equip, tipoInstalacao: e.target.value })}
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow/60"
              >
                <option value="">Selecione…</option>
                {TIPOS_INSTALACAO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </Grid>
        </Section>


        {/* 3. Peças */}
        <Section icon={Package} title="Peças e Materiais" defaultOpen>
          <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-2 text-[11px] uppercase tracking-wider text-[#888] font-semibold">
            <div className="col-span-6">Peça</div>
            <div className="col-span-2">Qtd</div>
            <div className="col-span-2">Valor un.</div>
            <div className="col-span-2 text-right pr-10">Total</div>
          </div>

          <ul className="space-y-2">
            {parts.map((p, i) => {
              const totalLinha = p.qty * p.price;
              return (
                <li
                  key={i}
                  className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-3"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-6">
                      <Input
                        value={p.name}
                        onChange={(v) => updatePart(i, { name: v })}
                        placeholder="Nome da peça"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={String(p.qty)}
                        onChange={(v) => updatePart(i, { qty: +v || 0 })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={String(p.price)}
                        onChange={(v) => updatePart(i, { price: +v || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right font-display text-yellow tracking-wide">
                      {brl(totalLinha)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removePart(i)}
                        aria-label="Remover"
                        className="grid place-items-center size-9 rounded-lg bg-[#1E1E1E] border border-[#2C2C2C] text-[#888] hover:text-red-400 hover:border-red-400/40 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <textarea
                      value={p.descricao || ""}
                      onChange={(e) => updatePart(i, { descricao: e.target.value })}
                      placeholder="Descrição detalhada da peça (marca, referência, especificação)"
                      className="w-full bg-[#111111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow placeholder:text-[#555] min-h-[52px] resize-none"
                    />
                    {!(p.descricao || "").trim() && p.name.trim() && (
                      <p className="text-[11px] mt-1 text-red-400">
                        ⚠ Descrição obrigatória por exigência legal
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={addBlankPart}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-yellow/60 text-yellow font-semibold text-sm hover:bg-yellow/10 transition"
            >
              <Plus size={16} strokeWidth={3} /> Adicionar peça manual
            </button>
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addBancoPart(e.target.value);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-[#111111] border border-[#2C2C2C] text-white text-sm font-semibold outline-none focus:border-yellow"
              >
                <option value="" disabled>
                  + Do banco de materiais
                </option>
                {bancoOptions.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-yellow"
              />
            </div>
          </div>
        </Section>

        {/* 4. Mão de Obra */}
        <Section icon={Wrench} title="Mão de Obra" defaultOpen>
          <div className="flex flex-col gap-2.5">
            {servicos.map((sv, i) => (
              <div
                key={i}
                className="relative rounded-[10px] border border-[#1E1E1E] bg-[#0D0D0D] p-[14px]"
              >
                {servicos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeServico(i)}
                    aria-label="Remover serviço"
                    className="absolute top-2 right-2 grid place-items-center size-8 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <Field label="Nome do serviço">
                  <Input
                    value={sv.nome}
                    onChange={(v) => updateServico(i, { nome: v })}
                    placeholder="Ex: Troca de óleo"
                  />
                </Field>
                <div className="mt-3">
                  <Field label="Descrição detalhada *">
                    <textarea
                      className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-3 text-white outline-none focus:border-yellow min-h-[72px] resize-none"
                      value={sv.desc}
                      onChange={(e) => updateServico(i, { desc: e.target.value })}
                      placeholder="Ex: Remoção, troca do óleo, filtros e sangria do sistema"
                    />
                    {!sv.desc.trim() && (sv.nome.trim() || sv.valor > 0) && (
                      <p className="text-[11px] mt-1 text-red-400">
                        ⚠ Descrição obrigatória por exigência legal
                      </p>
                    )}
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Valor da mão de obra (R$)">
                    <Input
                      type="number"
                      value={String(sv.valor)}
                      onChange={(v) => updateServico(i, { valor: +v || 0 })}
                      placeholder="0,00"
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addServico}
              className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-yellow text-yellow font-semibold text-sm hover:bg-yellow/10 transition"
            >
              <Plus size={16} strokeWidth={3} /> ADICIONAR SERVIÇO
            </button>
          </div>
        </Section>

        {/* 5. Resumo Financeiro */}
        <Section icon={Calculator} title="Resumo Financeiro" defaultOpen>
          <div className="rounded-xl bg-[#0D0D0D] border border-[#1E1E1E] divide-y divide-[#1E1E1E]">
            <Row label="Custo das peças" value={brl(totals.custoPecas)} />
            <Row label="Mão de obra" value={brl(maoObraTotal)} />
            <div className="px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Margem de lucro</span>
                <span className="font-display text-yellow text-lg">{margem}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={margem}
                onChange={(e) => setMargem(+e.target.value)}
                className="w-full accent-yellow mt-2"
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#666]">Ajuste fino:</span>
                <Input
                  type="number"
                  value={String(margem)}
                  onChange={(v) => setMargem(Math.max(0, Math.min(100, +v || 0)))}
                  className="!py-1.5 !text-sm w-24"
                />
                <span className="text-xs text-[#666]">%</span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Highlight
              label="Valor final"
              value={brl(totals.total)}
              accent
            />
            <Highlight label="Lucro estimado" value={brl(totals.lucro)} />
          </div>

          <div className="mt-4">
            <Field label="Observações">
              <textarea
                className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-3 text-white outline-none focus:border-yellow min-h-[72px] resize-none"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas ou para o cliente"
              />
            </Field>
          </div>
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-[#000000] via-[#000000]/95 to-transparent pt-6 pb-4 px-5">
        <div className="max-w-3xl mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="hidden sm:block">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#888]">
              Total do orçamento
            </p>
            <p className="font-display text-2xl text-yellow leading-none mt-1">
              {brl(totals.total)}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 flex gap-2">
            {editing && (
              <button
                type="button"
                onClick={cancelar}
                className="flex-1 sm:flex-none py-4 px-5 rounded-2xl bg-transparent border border-[#2C2C2C] text-white font-display tracking-wide hover:bg-[#0D0D0D] transition active:scale-[0.99]"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              className="relative flex-1 flex items-center justify-center gap-3 py-4 px-8 rounded-2xl bg-[#38BDF8] text-black font-display text-lg tracking-wide shadow-[0_10px_30px_-12px_rgba(245,197,24,0.6)] hover:brightness-110 transition active:scale-[0.99]"
            >
              <Save size={20} strokeWidth={2.5} />
              {editing ? "Salvar Alterações" : "Gerar Orçamento"}
            </button>
          </div>
        </div>
      </div>

      {showDraftPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "#0D0D0D", border: "1px solid #1E1E1E", borderTop: "2px solid #38BDF8" }}>
            <h3 className="text-white font-bold text-base">Orçamento não finalizado</h3>
            <p className="text-sm mt-1.5" style={{ color: "#A0A0A0" }}>
              Você tem um orçamento em rascunho. Deseja continuar de onde parou?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={descartarRascunho}
                className="font-bold text-sm py-3 rounded-xl text-white"
                style={{ background: "transparent", border: "1px solid #FF4444", color: "#FF4444" }}>
                Descartar
              </button>
              <button onClick={continuarRascunho}
                className="font-bold text-sm py-3 rounded-xl"
                style={{ background: "#38BDF8", color: "#000000" }}>
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      )}

      <VozOrcamentoModal
        open={vozOpen}
        onClose={() => setVozOpen(false)}
        onAplicar={aplicarVoz}
      />
    </main>

  );
}

/* ---------- Building blocks ---------- */

type IconType = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: IconType;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-[#1E1E1E] bg-[#0D0D0D] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left hover:bg-[#0D0D0D] transition"
      >
        <span className="grid place-items-center size-10 rounded-xl bg-[#1E1E1E] border border-[#2C2C2C] text-yellow">
          <Icon size={18} strokeWidth={2.25} />
        </span>
        <span className="font-display text-lg text-white tracking-wide truncate">
          {title}
        </span>
        <ChevronDown
          size={20}
          className={`text-[#888] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-[#1E1E1E]">{children}</div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-[#888] font-semibold">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: ReactNode }) {
  return (
    <div
      className={`grid gap-3 ${cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
    >
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "tel" | "numeric" | "email";
  className?: string;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow placeholder:text-[#555] ${className}`}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-[#888]">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function Highlight({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-4 border ${
        accent
          ? "bg-[#38BDF8]/10 border-yellow/50"
          : "bg-[#0D0D0D] border-[#1E1E1E]"
      }`}
    >
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-yellow" />
      <p className="pl-3 text-[11px] uppercase tracking-[0.14em] text-[#888] font-semibold">
        {label}
      </p>
      <p className="pl-3 mt-1 font-display text-2xl text-yellow tracking-wide">
        {value}
      </p>
    </div>
  );
}

/* Keep an unused import-friendly reference to avoid linter noise. */
void Cog;

function ClienteSearchInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: Cliente) => void;
}) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchClientes(value), [value]);
  const show = open && value.trim().length >= 2;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder="Ex: João da Silva"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl pl-4 pr-10 py-2.5 text-white outline-none focus:border-yellow placeholder:text-[#555]"
      />
      <Search
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-yellow"
      />
      {show && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E] shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[#888]">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(c);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-yellow/10 hover:border-l-2 hover:border-yellow transition border-l-2 border-transparent"
                  >
                    <p className="text-white text-sm font-semibold truncate">{c.nome}</p>
                    {c.telefone && (
                      <p className="text-xs text-[#888] mt-0.5">{c.telefone}</p>
                    )}
                    {c.ultimoVeiculo && (
                      <p className="text-[11px] text-[#666] mt-0.5 truncate">
                        ❄️ {c.ultimoVeiculo.marcaModelo} {c.ultimoVeiculo.ano}
                        {c.ultimoVeiculo.placa ? ` · ${c.ultimoVeiculo.placa}` : ""}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-[#1E1E1E] text-yellow text-sm font-semibold hover:bg-yellow/10 transition"
          >
            <UserPlus size={14} />
            Novo cliente “{value.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
