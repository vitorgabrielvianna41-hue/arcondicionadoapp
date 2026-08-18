import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Plus,
  FileText,
  ArrowRight,
} from "lucide-react";
import { listOrcamentos, getSettings, type Orcamento } from "@/lib/storage";
import { brl } from "@/lib/parts";
import { Logo } from "@/components/Logo";
import { BottomNav } from "@/components/BottomNav";
import { StatusBadge, statusBarColor } from "@/components/StatusBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OrçaAr Condicionado Pro — Gestão profissional de climatização" },
      {
        name: "description",
        content:
          "Painel premium para técnicos de climatização: orçamentos, aprovações, recebíveis e lucro do mês em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [items, setItems] = useState<Orcamento[]>([]);
  const [nomeOficina, setNomeOficina] = useState("Meus Serviços");

  useEffect(() => {
    setItems(listOrcamentos());
    const s = getSettings();
    if (s.company.nome) setNomeOficina(s.company.nome);
  }, []);

  const kpi = useMemo(() => {
    const emAberto = items.filter((o) => o.status === "enviado").length;
    const aprovados = items.filter((o) => o.status === "aprovado").length;
    const aReceber = items
      .filter((o) => o.status === "aprovado")
      .reduce((s, o) => s + o.totals.total, 0);
    const now = new Date();
    const mes = items.filter((o) => {
      const d = new Date(o.createdAt);
      return (
        o.status === "concluido" &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });
    const lucroMes = mes.reduce((s, o) => s + o.totals.total, 0);
    return { emAberto, aprovados, aReceber, lucroMes };
  }, [items]);

  const recent = items.slice(0, 5);
  const initials =
    nomeOficina
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "OB";

  return (
    <main className="min-h-screen bg-[#000000] text-white pb-24">
      {/* Header full-bleed */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#0D0D0D] to-[#000000] border-b border-[#1E1E1E]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #38BDF8 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 opacity-[0.08]"
          style={{
            background:
              "conic-gradient(from 0deg, #38BDF8 0 25%, transparent 25% 50%, #38BDF8 50% 75%, transparent 75%)",
            borderRadius: "9999px",
            filter: "blur(3px)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-5 lg:px-10 pt-6 pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <Logo />
            <Link
              to="/configuracoes"
              aria-label="Perfil da loja"
              className="shrink-0 size-11 rounded-full bg-[#1E1E1E] border border-[#2C2C2C] grid place-items-center text-yellow font-display text-base hover:border-yellow/60 transition-colors"
            >
              {initials}
            </Link>
          </div>

          <div className="mt-5">
            <p className="text-xs text-[#888] tracking-wide">
              Bem-vindo de volta 👋
            </p>
            <h1 className="font-display text-2xl md:text-3xl text-white truncate">
              {nomeOficina}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 lg:px-10 pt-6 lg:pt-8">
        {/* KPI grid: 2x2 mobile, 4-col desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          <KpiCard
            label="Em aberto"
            value={String(kpi.emAberto)}
            icon={ClipboardList}
            hint={kpi.emAberto === 0 ? "— nenhum ainda" : "aguardando"}
            hintTone="muted"
          />
          <KpiCard
            label="Aprovados"
            value={String(kpi.aprovados)}
            icon={CheckCircle2}
            hint={kpi.aprovados === 0 ? "— nenhum ainda" : "prontos p/ executar"}
            hintTone="muted"
          />
          <KpiCard
            label="A receber"
            value={brl(kpi.aReceber)}
            icon={Wallet}
            hint="↑ 0% este mês"
            hintTone="success"
          />
          <KpiCard
            label="Lucro do mês"
            value={brl(kpi.lucroMes)}
            icon={TrendingUp}
            hint="↑ 0% vs mês ant."
            hintTone="success"
          />
        </div>

        {/* Desktop split: CTA + recents */}
        <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
          {/* Left column on desktop */}
          <div className="lg:col-span-1 space-y-5">
            <Link
              to="/novo"
              className="group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-[#38BDF8] text-black font-display text-xl tracking-wide shadow-[0_10px_30px_-12px_rgba(245,197,24,0.6)] hover:brightness-110 transition active:scale-[0.99] overflow-hidden"
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0 2px, transparent 2px 8px)",
                }}
              />
              <span className="relative grid place-items-center size-8 rounded-lg bg-black/15 ring-1 ring-black/20">
                <Plus size={22} strokeWidth={3} />
              </span>
              <span className="relative">Novo orçamento</span>
            </Link>

            {/* Atalhos rápidos (desktop) */}
            <div className="hidden lg:block rounded-2xl border border-[#1E1E1E] bg-[#0D0D0D] p-5">
              <h3 className="font-display text-sm tracking-[0.18em] text-[#888] uppercase">
                Atalhos
              </h3>
              <div className="mt-4 space-y-2">
                <ShortcutLink to="/historico" label="Ver histórico" />
                <ShortcutLink to="/configuracoes" label="Configurações do perfil" />
              </div>
            </div>
          </div>

          {/* Right column on desktop */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg lg:text-xl tracking-wide text-white">
                Últimos orçamentos
              </h2>
              {items.length > 0 && (
                <Link
                  to="/historico"
                  className="text-yellow text-sm font-semibold inline-flex items-center gap-1"
                >
                  Ver todos <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {recent.length === 0 ? (
              <div className="rounded-2xl border border-[#1E1E1E] bg-[#0D0D0D] px-6 py-12 lg:py-16 text-center">
                <div className="mx-auto mb-4 grid place-items-center size-16 rounded-full bg-[#1E1E1E] border border-[#2C2C2C]">
                  <FileText size={28} className="text-[#777]" />
                </div>
                <p className="text-white font-semibold">
                  Nenhum orçamento criado ainda
                </p>
                <p className="text-sm text-[#888] mt-1">
                  Clique em "+ Novo orçamento" para criar o seu primeiro
                </p>
                <Link
                  to="/novo"
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow/60 text-yellow font-semibold text-sm hover:bg-yellow/10 transition"
                >
                  <Plus size={16} strokeWidth={3} />
                  Criar primeiro orçamento
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/orcamento/$id"
                      params={{ id: o.id }}
                      className="relative block bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl p-4 pl-5 hover:border-yellow/40 hover:shadow-lg hover:shadow-yellow/10 transition overflow-hidden"
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ backgroundColor: statusBarColor(o.status) }}
                      />
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">
                            {o.cliente.nome}
                          </p>
                          <p className="text-[#888] text-sm truncate">
                            {o.servicoNome}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <StatusBadge status={o.status} />
                            <span className="text-[#777] text-xs">
                              {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                        <p className="text-yellow font-display text-2xl whitespace-nowrap">
                          {brl(o.totals.total)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  hint?: string;
  hintTone?: "success" | "muted";
};

function KpiCard({ label, value, icon: Icon, hint, hintTone = "muted" }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0D0D0D] border border-[#1E1E1E] p-4 lg:p-5 pl-5 lg:pl-6">
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-yellow" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-[#888] uppercase tracking-[0.12em] font-semibold">
          {label}
        </p>
        <span className="grid place-items-center size-8 rounded-lg bg-[#1E1E1E] border border-[#2C2C2C]">
          <Icon size={16} className="text-yellow" strokeWidth={2.25} />
        </span>
      </div>
      <p className="mt-2 text-2xl lg:text-3xl font-display text-white tracking-wide">
        {value}
      </p>
      {hint && (
        <p
          className={`mt-1 text-[11px] font-semibold ${
            hintTone === "success" ? "text-emerald-400" : "text-[#666]"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function ShortcutLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl bg-[#111111] border border-[#1E1E1E] px-4 py-3 text-sm text-white hover:border-yellow/40 transition"
    >
      <span>{label}</span>
      <ArrowRight size={16} className="text-yellow" />
    </Link>
  );
}
