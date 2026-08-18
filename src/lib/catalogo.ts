export type CatalogoUnidade = "un" | "par" | "kit" | "jogo" | "hora" | "m";

export type CatalogoPeca = {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  unidade: CatalogoUnidade;
};

export type CatalogoServico = {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  unidade: CatalogoUnidade;
};

const KP = "catalogo_pecas";
const KS = "catalogo_servicos";
export const PICK_KEY = "catalogo_pick";

export type PickPayload =
  | { kind: "peca"; item: CatalogoPeca }
  | { kind: "servico"; item: CatalogoServico };

const safe = () => typeof window !== "undefined";

function load<T>(k: string): T[] {
  if (!safe()) return [];
  try {
    return JSON.parse(localStorage.getItem(k) ?? "[]");
  } catch {
    return [];
  }
}

function save<T>(k: string, arr: T[]) {
  if (!safe()) return;
  localStorage.setItem(k, JSON.stringify(arr));
}

export const listPecas = (): CatalogoPeca[] => load(KP);
export const listServicos = (): CatalogoServico[] => load(KS);

export function upsertPeca(p: CatalogoPeca) {
  const arr = listPecas().filter((x) => x.id !== p.id);
  arr.unshift(p);
  save(KP, arr);
}
export function deletePeca(id: string) {
  save(KP, listPecas().filter((x) => x.id !== id));
}

export function upsertServico(s: CatalogoServico) {
  const arr = listServicos().filter((x) => x.id !== s.id);
  arr.unshift(s);
  save(KS, arr);
}
export function deleteServico(id: string) {
  save(KS, listServicos().filter((x) => x.id !== id));
}

export function setPick(p: PickPayload) {
  if (!safe()) return;
  sessionStorage.setItem(PICK_KEY, JSON.stringify(p));
}

export function consumePick(): PickPayload | null {
  if (!safe()) return null;
  const raw = sessionStorage.getItem(PICK_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PICK_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}