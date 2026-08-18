import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Building2, FileText, MapPin, Phone, Mail,
  Percent, CalendarDays, MessageSquare, Image as ImageIcon,
  Palette, Crown, Check, Save, Wrench,
} from "lucide-react";
import { PART_LABELS } from "@/lib/parts";
import { getSettings, resetPrices, saveSettings, type Settings } from "@/lib/storage";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Perfil — OrçaAr Condicionado Pro" }] }),
  component: Config,
});

const YELLOW = "#38BDF8";
const BG = "#000000";

const fieldCls =
  "w-full bg-[#1a1a1a] text-white placeholder:text-neutral-500 rounded-xl pl-11 pr-4 py-3 outline-none border border-neutral-800 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition";

function Field({
  icon: Icon, children,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#38BDF8]" />
      {children}
    </div>
  );
}

function SectionCard({
  title, icon: Icon, children,
}: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#0D0D0D] p-5 mb-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={20} className="text-[#38BDF8]" />
        <h2 className="text-white font-display text-lg tracking-wide">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Config() {
  const [s, setS] = useState<Settings>(() => getSettings());

  const initials = useMemo(() => {
    const n = (s.company.nome || "Oficina").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "O") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
  }, [s.company.nome]);

  const save = () => {
    saveSettings(s);
    alert("Alterações salvas!");
  };
  const reset = () => {
    if (!confirm("Restaurar preços padrão?")) return;
    setS(resetPrices());
  };
  const onLogo = (file: File) => {
    const r = new FileReader();
    r.onload = () => setS({ ...s, company: { ...s.company, logo: String(r.result) } });
    r.readAsDataURL(file);
  };

  const setCo = (patch: Partial<Settings["company"]>) =>
    setS({ ...s, company: { ...s.company, ...patch } });

  return (
    <main className="min-h-screen pb-28" style={{ background: BG }}>
      {/* Top bar */}
      <div className="max-w-xl mx-auto px-4 pt-5 pb-2 flex items-center gap-3">
        <Link to="/" className="text-[#38BDF8]"><ArrowLeft size={24} /></Link>
        <h1 className="text-white text-2xl font-display">Perfil</h1>
      </div>

      {/* Header */}
      <header className="max-w-xl mx-auto px-4 pt-4 pb-6 flex flex-col items-center text-center">
        <div className="relative">
          {s.company.logo ? (
            <img src={s.company.logo} alt="Logo" className="h-24 w-24 rounded-full object-cover bg-white p-1 border-2 border-[#38BDF8]" />
          ) : (
            <div
              className="h-24 w-24 rounded-full flex items-center justify-center text-3xl font-display font-bold"
              style={{ background: YELLOW, color: BG }}
            >
              {initials}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 bg-[#38BDF8] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">PRO</span>
        </div>
        <h2 className="mt-3 text-white text-2xl font-display">{s.company.nome || "Meus Serviços"}</h2>
        <p className="text-neutral-400 text-sm flex items-center gap-1">
          <MapPin size={14} className="text-[#38BDF8]" />
          {s.company.cidadeEstado || "Cidade / Estado"}
        </p>
      </header>

      <div className="max-w-xl mx-auto px-4">
        {/* 1) Dados do Perfil */}
        <SectionCard title="Dados do Perfil" icon={Building2}>
          <Field icon={Building2}>
            <input className={fieldCls} placeholder="Nome" value={s.company.nome}
              onChange={(e) => setCo({ nome: e.target.value })} />
          </Field>
          <Field icon={FileText}>
            <input className={fieldCls} placeholder="CNPJ ou CPF" value={s.company.documento}
              onChange={(e) => setCo({ documento: e.target.value })} />
          </Field>
          <Field icon={MapPin}>
            <input className={fieldCls} placeholder="Endereço" value={s.company.endereco}
              onChange={(e) => setCo({ endereco: e.target.value })} />
          </Field>
          <Field icon={MapPin}>
            <input className={fieldCls} placeholder="Cidade / Estado" value={s.company.cidadeEstado}
              onChange={(e) => setCo({ cidadeEstado: e.target.value })} />
          </Field>
          <Field icon={Phone}>
            <input className={fieldCls} placeholder="Telefone" value={s.company.telefone}
              onChange={(e) => setCo({ telefone: e.target.value })} />
          </Field>
          <Field icon={Mail}>
            <input className={fieldCls} type="email" placeholder="E-mail" value={s.company.email}
              onChange={(e) => setCo({ email: e.target.value })} />
          </Field>
        </SectionCard>

        {/* 2) Configurações de Orçamento */}
        <SectionCard title="Configurações de Orçamento" icon={Percent}>
          <Field icon={Percent}>
            <input type="number" className={fieldCls} placeholder="Margem de lucro padrão (%)"
              value={s.margemPadrao}
              onChange={(e) => setS({ ...s, margemPadrao: +e.target.value || 0 })} />
          </Field>
          <Field icon={CalendarDays}>
            <input type="number" className={fieldCls} placeholder="Validade padrão (dias)"
              value={s.validadeDias}
              onChange={(e) => setS({ ...s, validadeDias: +e.target.value || 7 })} />
          </Field>
          <Field icon={Wrench}>
            <input type="number" className={fieldCls} placeholder="Mão de obra (R$/hora)"
              value={s.maoObraHora}
              onChange={(e) => setS({ ...s, maoObraHora: +e.target.value || 0 })} />
          </Field>
          <div className="relative">
            <MessageSquare size={18} className="absolute left-3 top-3 text-[#38BDF8]" />
            <textarea
              className={`${fieldCls} min-h-[90px] pt-3`}
              placeholder="Mensagem de rodapé personalizada"
              value={s.rodapeMensagem}
              onChange={(e) => setS({ ...s, rodapeMensagem: e.target.value })}
            />
          </div>
        </SectionCard>

        {/* 3) Personalização */}
        <SectionCard title="Personalização" icon={Palette}>
          <label className="block">
            <span className="text-xs text-neutral-400 flex items-center gap-2 mb-2">
              <ImageIcon size={14} className="text-[#38BDF8]" /> Logo da loja
            </span>
            <div className="flex items-center gap-3">
              {s.company.logo ? (
                <img src={s.company.logo} alt="Logo" className="h-14 w-14 rounded-lg object-cover bg-white p-1 border border-neutral-700" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-[#1a1a1a] border border-dashed border-neutral-700 flex items-center justify-center text-neutral-500">
                  <ImageIcon size={20} />
                </div>
              )}
              <label className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-neutral-700 text-white text-sm cursor-pointer hover:border-[#38BDF8]">
                Enviar imagem
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
              </label>
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-neutral-400 flex items-center gap-2 mb-2">
              <Palette size={14} className="text-[#38BDF8]" /> Cor de destaque
            </span>
            <div className="flex items-center gap-3">
              <input type="color" value={s.accentColor}
                onChange={(e) => setS({ ...s, accentColor: e.target.value })}
                className="h-11 w-14 rounded-lg bg-transparent border border-neutral-700 cursor-pointer" />
              <input
                className="flex-1 bg-[#1a1a1a] text-white rounded-xl px-4 py-3 outline-none border border-neutral-800 focus:border-[#38BDF8]"
                value={s.accentColor}
                onChange={(e) => setS({ ...s, accentColor: e.target.value })}
              />
            </div>
          </label>
        </SectionCard>

        {/* 4) Plano Atual */}
        <SectionCard title="Plano Atual" icon={Crown}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown size={22} className="text-[#38BDF8]" />
              <div>
                <p className="text-white font-display text-lg leading-none">OrçaAr Condicionado</p>
                <p className="text-neutral-400 text-xs mt-1">Assinatura ativa</p>
              </div>
            </div>
            <span className="bg-[#38BDF8] text-black text-xs font-bold px-3 py-1 rounded-full tracking-wide">PRO</span>
          </div>

          <ul className="mt-2 space-y-2">
            {[
              "Orçamentos ilimitados",
              "PDF com logo da oficina",
              "Cobrança via Pix",
              "Histórico e relatórios",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-neutral-200">
                <Check size={16} className="text-[#38BDF8]" /> {f}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-[#38BDF8] text-[#38BDF8] font-semibold py-3 hover:bg-[#38BDF8]/10 transition"
          >
            Gerenciar assinatura
          </button>
        </SectionCard>

        {/* Preços (mantido) */}
        <SectionCard title="Preços das peças" icon={Wrench}>
          <div className="flex items-center justify-between -mt-1">
            <p className="text-xs text-neutral-500">
              Atualizado em {new Date(s.pricesUpdated).toLocaleDateString("pt-BR")}
            </p>
            <button onClick={reset} className="text-xs text-red-400 font-semibold">
              Restaurar padrão
            </button>
          </div>
          <div className="space-y-2 pt-2">
            {Object.entries(s.prices).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-white text-sm flex-1">{PART_LABELS[k] ?? k}</span>
                <input type="number" step="0.01"
                  className="bg-[#1a1a1a] text-white rounded-lg px-2 py-1 w-24 text-right border border-neutral-800 focus:border-[#38BDF8] outline-none"
                  value={v}
                  onChange={(e) => setS({
                    ...s,
                    prices: { ...s.prices, [k]: +e.target.value || 0 },
                    pricesUpdated: new Date().toISOString(),
                  })} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-[#000000]/95 backdrop-blur px-4 py-3 z-40">
        <div className="max-w-xl mx-auto">
          <button
            onClick={save}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-black text-base shadow-lg"
            style={{ background: YELLOW }}
          >
            <Save size={18} /> Salvar Alterações
          </button>
        </div>
      </div>
    </main>
  );
}
