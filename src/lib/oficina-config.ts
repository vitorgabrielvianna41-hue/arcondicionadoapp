export type OficinaConfig = {
  logoDataUrl?: string;
  nome: string;
  endereco: string;
  telefone: string;
  cnpj: string;
  slogan: string;
  email?: string;
  website?: string;
};

export type PdfOptions = {
  showAssinatura: boolean;
  showObservacoes: boolean;
  showNaoVerificados: boolean;
  apenasProblemas: boolean;
};

export type OrcamentoPdfConfig = {
  logoDataUrl?: string;
  corDestaque: string;
  rodapeTexto: string;
  mostrarValidade: boolean;
  mostrarVeiculo: boolean;
  mostrarSeparacao: boolean;
  mostrarNumeroOS: boolean;
  mostrarObservacoes: boolean;
  modelo: "profissional" | "classico" | "minimalista";
};

const KEY = "oficina_config";
const OPT_KEY = "oficina_pdf_options";
const ORC_PDF_KEY = "oficina_orcamento_pdf";
const ORC_LOGO_KEY = "oficina_logo_orcamento";
const ORC_RODAPE_KEY = "oficina_rodape";

const DEFAULT: OficinaConfig = {
  logoDataUrl: undefined,
  nome: "",
  endereco: "",
  telefone: "",
  cnpj: "",
  slogan: "",
};

const DEFAULT_OPT: PdfOptions = {
  showAssinatura: true,
  showObservacoes: true,
  showNaoVerificados: true,
  apenasProblemas: false,
};

const DEFAULT_ORC_PDF: OrcamentoPdfConfig = {
  logoDataUrl: undefined,
  corDestaque: "#38BDF8",
  rodapeTexto:
    "Orçamento válido por 7 dias. Peças com garantia de 90 dias. Serviços com garantia de 30 dias.",
  mostrarValidade: true,
  mostrarVeiculo: true,
  mostrarSeparacao: true,
  mostrarNumeroOS: false,
  mostrarObservacoes: true,
  modelo: "profissional",
};

export function loadOficina(): OficinaConfig {
  if (typeof window === "undefined") return DEFAULT;
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT;
  }
}

export function saveOficina(c: OficinaConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function loadPdfOptions(): PdfOptions {
  if (typeof window === "undefined") return DEFAULT_OPT;
  try {
    return { ...DEFAULT_OPT, ...JSON.parse(localStorage.getItem(OPT_KEY) ?? "{}") };
  } catch {
    return DEFAULT_OPT;
  }
}

export function savePdfOptions(o: PdfOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPT_KEY, JSON.stringify(o));
}

export function loadOrcamentoPdf(): OrcamentoPdfConfig {
  if (typeof window === "undefined") return DEFAULT_ORC_PDF;
  try {
    const base = { ...DEFAULT_ORC_PDF, ...JSON.parse(localStorage.getItem(ORC_PDF_KEY) ?? "{}") };
    // legacy fallbacks
    if (!base.logoDataUrl) {
      const l = localStorage.getItem(ORC_LOGO_KEY);
      if (l) base.logoDataUrl = l;
    }
    const r = localStorage.getItem(ORC_RODAPE_KEY);
    if (r && !base.rodapeTexto) base.rodapeTexto = r;
    return base;
  } catch {
    return DEFAULT_ORC_PDF;
  }
}

export function saveOrcamentoPdf(c: OrcamentoPdfConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORC_PDF_KEY, JSON.stringify(c));
  if (c.logoDataUrl) localStorage.setItem(ORC_LOGO_KEY, c.logoDataUrl);
  if (c.rodapeTexto) localStorage.setItem(ORC_RODAPE_KEY, c.rodapeTexto);
}