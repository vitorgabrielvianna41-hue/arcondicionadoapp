import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, Package, User, ArrowLeft, Bot, ClipboardCheck } from "lucide-react";

const items = [
  { to: "/", label: "Início", icon: Home, match: (p: string) => p === "/" },
  {
    to: "/historico",
    label: "Orçamentos",
    icon: ClipboardList,
    backIcon: ArrowLeft,
    match: (p: string) => p.startsWith("/historico") || p.startsWith("/orcamento"),
  },
  {
    to: "/pecas",
    label: "Materiais",
    icon: Package,
    match: (p: string) => p.startsWith("/pecas"),
  },
  {
    to: "/checklist",
    label: "Checklist",
    icon: ClipboardCheck,
    match: (p: string) => p.startsWith("/checklist"),
  },
  {
    to: "/ia",
    label: "IA Climatização",
    icon: Bot,
    match: (p: string) => p.startsWith("/ia"),
  },
  {
    to: "/configuracoes",
    label: "Perfil",
    icon: User,
    match: (p: string) => p.startsWith("/configuracoes"),
  },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#000000]/95 backdrop-blur border-t border-[#1E1E1E]"
    >
      <ul className="max-w-xl mx-auto grid grid-cols-6">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const BackIcon = "backIcon" in item ? item.backIcon : undefined;
          const DisplayIcon = active && BackIcon ? BackIcon : Icon;
          const linkTo = active && BackIcon ? "/" : item.to;
          return (
            <li key={item.label}>
              <Link
                to={linkTo}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                  active ? "text-yellow" : "text-[#777] hover:text-white"
                }`}
              >
                <DisplayIcon size={20} strokeWidth={2.25} />
                <span>{item.label}</span>
                <span
                  className={`h-0.5 w-6 rounded-full ${active ? "bg-yellow" : "bg-transparent"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
