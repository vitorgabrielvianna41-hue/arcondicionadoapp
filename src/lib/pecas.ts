export type PecaCategoria =
  | "Tubulação e Isolamento"
  | "Elétrica"
  | "Suportes e Fixação"
  | "Dreno"
  | "Gás e Refrigeração"
  | "Componentes"
  | "Acessórios"
  | "Outros";

export const CATEGORIAS: PecaCategoria[] = [
  "Tubulação e Isolamento",
  "Elétrica",
  "Suportes e Fixação",
  "Dreno",
  "Gás e Refrigeração",
  "Componentes",
  "Acessórios",
  "Outros",
];

export type Peca = {
  id: string;
  nome: string;
  categoria: PecaCategoria;
  fornecedor: string;
  codigo?: string;
  quantidade: number;
  custo: number;
  margem: number;
  venda: number;
  observacoes?: string;
  createdAt: string;
};

const KEY = "om_pecas_v1";
const safe = () => typeof window !== "undefined";

export function listPecas(): Peca[] {
  if (!safe()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function savePeca(p: Peca) {
  if (!safe()) return;
  const all = listPecas().filter((x) => x.id !== p.id);
  all.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deletePeca(id: string) {
  if (!safe()) return;
  localStorage.setItem(KEY, JSON.stringify(listPecas().filter((p) => p.id !== id)));
}

export function calcVenda(custo: number, margem: number) {
  return +(custo * (1 + margem / 100)).toFixed(2);
}

export function calcMargem(custo: number, venda: number) {
  if (!custo) return 0;
  return +(((venda - custo) / custo) * 100).toFixed(2);
}
