import { Snowflake } from "lucide-react";

type Props = { size?: number; showText?: boolean; className?: string };

export function Logo({ size = 36, showText = true, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="grid place-items-center rounded-xl"
        style={{
          width: size,
          height: size,
          background: "#38BDF8",
          boxShadow: "0 4px 14px -4px rgba(255, 214, 10, 0.55)",
        }}
        aria-hidden="true"
      >
        <Snowflake size={size * 0.62} strokeWidth={2.5} color="#000000" />
      </div>
      {showText && (
        <div className="leading-none">
          <div className="font-display text-xl tracking-wide whitespace-nowrap">
            <span className="text-yellow">ORÇA</span>
            <span className="text-white"> AR CONDICIONADO</span>
          </div>
          <div className="font-display text-[10px] tracking-[0.35em] text-muted-foreground -mt-0.5">
            PRO
          </div>
        </div>
      )}
    </div>
  );
}
