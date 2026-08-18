import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2, AlertTriangle, Check } from "lucide-react";

export type VozMaterial = {
  key?: string;
  nome?: string;
  quantidade?: number;
  unidade?: string;
};

export type VozServico = { nome?: string; descricao?: string; valor?: number };

export type VozDados = {
  cliente?: { nome?: string; telefone?: string; endereco?: string };
  servico?: {
    tipoServico?: string;
    tipoEquipamento?: string;
    capacidade?: string;
    ambiente?: string;
    tipoInstalacao?: string;
    quantidade?: number;
    marca?: string;
    modelo?: string;
  };
  materiais?: VozMaterial[];
  servicos?: VozServico[];
  camposIncertos?: string[];
  resumo?: string;
};

type Estado = "idle" | "gravando" | "processando" | "revisao" | "erro";

/** Concatena chunks PCM float e escreve um arquivo WAV 16-bit mono completo. */
function encodeWav(chunks: Float32Array[], sampleRate: number, target = 16000): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const flat = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    flat.set(c, off);
    off += c.length;
  }
  // downsample simples
  const ratio = sampleRate / target;
  const outLen = ratio > 1 ? Math.floor(flat.length / ratio) : flat.length;
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = flat[Math.floor(i * (ratio > 1 ? ratio : 1))];
  const rate = ratio > 1 ? target : sampleRate;

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, out.length * 2, true);
  let p = 44;
  for (let i = 0; i < out.length; i++, p += 2) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const BARS = 13;

export function VozOrcamentoModal({
  open,
  onClose,
  onAplicar,
}: {
  open: boolean;
  onClose: () => void;
  onAplicar: (dados: VozDados) => void;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [erro, setErro] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [dados, setDados] = useState<VozDados | null>(null);
  const [niveis, setNiveis] = useState<number[]>(() => Array(BARS).fill(0.2));

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const limpar = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    nodeRef.current?.disconnect();
    srcRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    nodeRef.current = null;
    srcRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  };

  useEffect(() => () => limpar(), []);

  useEffect(() => {
    if (!open) {
      limpar();
      setEstado("idle");
      setErro("");
      setSegundos(0);
      setTranscript("");
      setDados(null);
    }
  }, [open]);

  useEffect(() => {
    if (estado !== "gravando") return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [estado]);

  const iniciar = async () => {
    setErro("");
    setTranscript("");
    setDados(null);
    setSegundos(0);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setEstado("erro");
      setErro("Permita o acesso ao microfone para usar o orçamento por voz.");
      return;
    }
    streamRef.current = stream;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    srcRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;
    const node = ctx.createScriptProcessor(4096, 1, 1);
    nodeRef.current = node;
    chunksRef.current = [];
    node.onaudioprocess = (e) =>
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    source.connect(analyser);
    source.connect(node);
    node.connect(ctx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const arr: number[] = [];
      for (let i = 0; i < BARS; i++) {
        const v = data[Math.floor((i / BARS) * data.length)] / 255;
        arr.push(Math.max(0.15, Math.min(1, v * 1.6)));
      }
      setNiveis(arr);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    setEstado("gravando");
  };

  const parar = async () => {
    const ctx = ctxRef.current;
    const rate = ctx?.sampleRate ?? 44100;
    const chunks = chunksRef.current;
    limpar();
    setEstado("processando");
    const blob = encodeWav(chunks, rate);
    if (blob.size < 4096) {
      setEstado("erro");
      setErro("Não conseguimos entender o áudio. Tente falar novamente.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("audio", blob, "gravacao.wav");
      const res = await fetch("/api/voz-orcamento", { method: "POST", body: fd });
      if (!res.ok) {
        setEstado("erro");
        setErro("Não conseguimos entender o áudio. Tente falar novamente.");
        return;
      }
      const json = (await res.json()) as { transcript: string; dados: VozDados };
      setTranscript(json.transcript || "");
      setDados(json.dados || {});
      setEstado("revisao");
    } catch {
      setEstado("erro");
      setErro("Falha de conexão ao processar o áudio. Tente novamente.");
    }
  };

  if (!open) return null;

  const incertos = dados?.camposIncertos?.filter(Boolean) ?? [];
  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-[#0D0D0D] border border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E1E]">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-yellow" />
            <h2 className="font-display text-xl tracking-wide">Orçamento por voz</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid place-items-center size-9 rounded-full bg-[#111111] border border-[#1E1E1E] text-[#888] hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-6 overflow-y-auto">
          {(estado === "idle" || estado === "erro") && (
            <div className="text-center">
              <p className="text-lg font-semibold text-white">Fale os detalhes do serviço</p>
              <p className="mt-2 text-sm text-[#9AA4B2] leading-relaxed">
                Exemplo: “instalação de um ar-condicionado Split Inverter de 12.000 BTUs, 4 metros
                de cobre, suporte, dreno e mão de obra de 350 reais.”
              </p>
              {erro && (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400">
                  <AlertTriangle size={16} /> {erro}
                </p>
              )}
              <button
                type="button"
                onClick={iniciar}
                className="mt-7 mx-auto grid place-items-center size-24 rounded-full bg-yellow text-black active:scale-95 transition"
                style={{ animation: "voice-pulse 2s infinite" }}
                aria-label="Iniciar gravação"
              >
                <Mic size={34} strokeWidth={2.4} />
              </button>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#888]">
                Toque para gravar
              </p>
            </div>
          )}

          {estado === "gravando" && (
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-yellow font-bold">
                🎙️ Gravando… {mm}:{ss}
              </p>
              <div className="mt-8 flex items-end justify-center gap-1.5 h-24">
                {niveis.map((n, i) => (
                  <span
                    key={i}
                    className="w-2.5 rounded-full bg-yellow"
                    style={{ height: `${Math.round(n * 100)}%`, transition: "height 90ms linear" }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={parar}
                className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-red-500/15 border border-red-500/60 text-red-300 font-bold uppercase tracking-wide active:scale-95 transition"
              >
                <Square size={16} fill="currentColor" /> Parar gravação
              </button>
            </div>
          )}

          {estado === "processando" && (
            <div className="text-center py-10">
              <Loader2 size={38} className="mx-auto animate-spin text-yellow" />
              <p className="mt-4 text-sm text-[#9AA4B2]">
                Transcrevendo e interpretando o seu áudio…
              </p>
            </div>
          )}

          {estado === "revisao" && dados && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-yellow/40 bg-yellow/5 px-4 py-3">
                <p className="text-sm font-semibold text-yellow">
                  Confira os dados antes de gerar o orçamento.
                </p>
              </div>

              {transcript && (
                <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#888] mb-1">
                    O que ouvimos
                  </p>
                  <p className="text-sm text-[#CBD5E1]">{transcript}</p>
                </div>
              )}

              <ul className="space-y-1.5 text-sm">
                <Linha label="Cliente" valor={dados.cliente?.nome} />
                <Linha label="Telefone" valor={dados.cliente?.telefone} />
                <Linha label="Endereço" valor={dados.cliente?.endereco} />
                <Linha label="Serviço" valor={dados.servico?.tipoServico} />
                <Linha label="Equipamento" valor={dados.servico?.tipoEquipamento} />
                <Linha label="Capacidade" valor={dados.servico?.capacidade} />
                <Linha label="Ambiente" valor={dados.servico?.ambiente} />
                <Linha label="Instalação" valor={dados.servico?.tipoInstalacao} />
              </ul>

              {!!dados.materiais?.length && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#888] mb-1.5">
                    Materiais
                  </p>
                  <ul className="space-y-1 text-sm">
                    {dados.materiais.map((m, i) => (
                      <li key={i} className="text-[#CBD5E1]">
                        • {m.nome || m.key} — {m.quantidade ?? "?"} {m.unidade || ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!dados.servicos?.length && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#888] mb-1.5">
                    Serviços / mão de obra
                  </p>
                  <ul className="space-y-1 text-sm">
                    {dados.servicos.map((s, i) => (
                      <li key={i} className="text-[#CBD5E1]">
                        • {s.nome || s.descricao} — R$ {(s.valor ?? 0).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!incertos.length && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm text-amber-300 font-semibold flex items-center gap-2">
                    <AlertTriangle size={15} /> Alguns dados não foram identificados
                  </p>
                  <ul className="mt-1.5 text-xs text-amber-200/90 space-y-0.5">
                    {incertos.map((c, i) => (
                      <li key={i}>⚠️ Confira este campo: {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={iniciar}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#2C2C2C] text-white font-semibold active:scale-[0.98] transition"
                >
                  Gravar novamente
                </button>
                <button
                  type="button"
                  onClick={() => onAplicar(dados)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow text-black font-bold uppercase tracking-wide active:scale-[0.98] transition"
                >
                  <Check size={17} strokeWidth={3} /> Confirmar e continuar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor?: string }) {
  return (
    <li className="flex gap-2">
      <span className="text-[#888] min-w-[104px]">{label}:</span>
      <span className={valor ? "text-white" : "text-amber-300"}>
        {valor || "⚠️ não identificado"}
      </span>
    </li>
  );
}
