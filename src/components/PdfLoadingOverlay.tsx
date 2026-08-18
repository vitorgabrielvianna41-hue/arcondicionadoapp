import { useEffect, useState } from "react";

const MSGS = [
  "Montando seu orçamento…",
  "Calculando peças…",
  "Aplicando margem…",
  "Finalizando PDF…",
];

export function PdfLoadingOverlay({ open }: { open: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!open) return;
    setI(0);
    const t = setInterval(() => setI((v) => (v + 1) % MSGS.length), 700);
    return () => clearInterval(t);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
      <div className="size-16 rounded-full border-4 border-yellow/30 border-t-yellow animate-spin mb-6" />
      <p className="text-yellow font-display text-2xl tracking-wide">{MSGS[i]}</p>
      <p className="text-muted-foreground text-sm mt-2">Aguarde alguns segundos…</p>
    </div>
  );
}
