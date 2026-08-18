import type { StatusOrc } from "@/lib/storage";

export const STATUS_LABELS: Record<StatusOrc, string> = {
  enviado: "Enviado",
  aprovado: "Aprovado",
  concluido: "Concluído",
};

export function statusBarColor(s: StatusOrc): string {
  if (s === "aprovado") return "#38BDF8";
  if (s === "concluido") return "#22c55e";
  return "#64748b";
}

export function StatusBadge({ status }: { status: StatusOrc }) {
  const styles: Record<StatusOrc, string> = {
    enviado: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    aprovado: "bg-yellow/20 text-yellow border-yellow/40",
    concluido: "bg-success/20 text-success border-success/40",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
