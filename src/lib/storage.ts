import { DEFAULT_PRICES } from "./parts";

export type Company = {
  nome: string;
  telefone: string;
  documento: string;
  cidadeEstado: string;
  endereco: string;
  email: string;
  logo: string;
};

export type Settings = {
  company: Company;
  prices: Record<string, number>;
  pricesUpdated: string;
  validadeDias: number;
  margemPadrao: number;
  maoObraHora: number;
  pixKey: string;
  pixNome: string;
  pixCidade: string;
  rodapeMensagem: string;
  accentColor: string;
};

export type LinePart = {
  key: string;
  name: string;
  descricao?: string;
  qty: number;
  unit: string;
  price: number;
};

export type StatusOrc = "enviado" | "aprovado" | "concluido";

export type Orcamento = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  cliente: { nome: string; telefone: string };
  veiculo: { marcaModelo: string; ano: string; placa: string };
  servicoId: string;
  servicoNome: string;
  motorL: number;
  cilindros: number;
  margem: number;
  maoObra: number;
  parts: LinePart[];
  servicosDetalhados?: { nome: string; descricao: string; valor: number }[];
  totals: {
    pecas: number;
    maoObra: number;
    total: number;
    lucro: number;
  };
  status: StatusOrc;
  observacoes?: string;
  fotoDataUrl?: string;
  parcelas?: number; // 1 | 2 | 3
  os?: string;
};

export type Vehicle = {
  placa: string;
  marcaModelo: string;
  ano: string;
  clienteNome: string;
  clienteTelefone: string;
  updatedAt: string;
};

const SETTINGS_KEY = "om_settings_v1";
const ORC_KEY = "om_orcamentos_v1";
const VEH_KEY = "om_vehicles_v1";

const DEFAULT_SETTINGS: Settings = {
  company: { nome: "", telefone: "", documento: "", cidadeEstado: "", endereco: "", email: "", logo: "" },
  prices: { ...DEFAULT_PRICES },
  pricesUpdated: new Date().toISOString(),
  validadeDias: 7,
  margemPadrao: 50,
  maoObraHora: 80,
  pixKey: "",
  pixNome: "",
  pixCidade: "SAO PAULO",
  rodapeMensagem: "Obrigado pela preferência!",
  accentColor: "#38BDF8",
};

const safe = () => typeof window !== "undefined";

export function getSettings(): Settings {
  if (!safe()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      prices: { ...DEFAULT_PRICES, ...(parsed.prices ?? {}) },
      company: { ...DEFAULT_SETTINGS.company, ...(parsed.company ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (!safe()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function resetPrices() {
  const s = getSettings();
  s.prices = { ...DEFAULT_PRICES };
  s.pricesUpdated = new Date().toISOString();
  saveSettings(s);
  return s;
}

export function listOrcamentos(): Orcamento[] {
  if (!safe()) return [];
  try {
    const arr: Orcamento[] = JSON.parse(localStorage.getItem(ORC_KEY) ?? "[]");
    // backfill status para itens antigos
    return arr.map((o) => ({ ...o, status: o.status ?? "enviado" }));
  } catch {
    return [];
  }
}

export function saveOrcamento(o: Orcamento) {
  const all = listOrcamentos().filter((x) => x.id !== o.id);
  all.unshift(o);
  const trimmed = all.slice(0, 50);
  localStorage.setItem(ORC_KEY, JSON.stringify(trimmed));
  // upsert veículo
  if (o.veiculo.placa || o.veiculo.marcaModelo) {
    upsertVehicle({
      placa: (o.veiculo.placa || "").toUpperCase(),
      marcaModelo: o.veiculo.marcaModelo,
      ano: o.veiculo.ano,
      clienteNome: o.cliente.nome,
      clienteTelefone: o.cliente.telefone,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function getOrcamento(id: string): Orcamento | undefined {
  return listOrcamentos().find((o) => o.id === id);
}

export function deleteOrcamento(id: string) {
  localStorage.setItem(
    ORC_KEY,
    JSON.stringify(listOrcamentos().filter((o) => o.id !== id))
  );
}

export function updateOrcamento(id: string, patch: Partial<Orcamento>) {
  const all = listOrcamentos();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  localStorage.setItem(ORC_KEY, JSON.stringify(all));
  return all[idx];
}

// ===== Vehicles =====
export function listVehicles(): Vehicle[] {
  if (!safe()) return [];
  try {
    return JSON.parse(localStorage.getItem(VEH_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function upsertVehicle(v: Vehicle) {
  if (!safe()) return;
  const key = (v.placa || `${v.marcaModelo}|${v.clienteNome}`).toUpperCase();
  const all = listVehicles().filter(
    (x) => (x.placa || `${x.marcaModelo}|${x.clienteNome}`).toUpperCase() !== key
  );
  all.unshift(v);
  localStorage.setItem(VEH_KEY, JSON.stringify(all.slice(0, 200)));
}

export function findVehicleByPlaca(placa: string): Vehicle | undefined {
  const p = (placa || "").toUpperCase().trim();
  if (!p) return undefined;
  return listVehicles().find((v) => v.placa.toUpperCase() === p);
}

// ===== Clientes (derivados dos veículos cadastrados) =====
export type Cliente = {
  nome: string;
  telefone: string;
  ultimoVeiculo?: Vehicle;
};

export function listClientes(): Cliente[] {
  const veh = listVehicles();
  const map = new Map<string, Cliente>();
  for (const v of veh) {
    const nome = (v.clienteNome || "").trim();
    if (!nome) continue;
    const key = `${nome.toLowerCase()}|${(v.clienteTelefone || "").replace(/\D/g, "")}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { nome, telefone: v.clienteTelefone || "", ultimoVeiculo: v });
    } else if (
      !cur.ultimoVeiculo ||
      new Date(v.updatedAt).getTime() > new Date(cur.ultimoVeiculo.updatedAt).getTime()
    ) {
      cur.ultimoVeiculo = v;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function searchClientes(q: string, limit = 6): Cliente[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  return listClientes()
    .filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.telefone.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    )
    .slice(0, limit);
}
