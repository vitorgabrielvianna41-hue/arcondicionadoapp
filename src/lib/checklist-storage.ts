export type ChecklistFase = "entrada" | "saida";
export type ChecklistTipo = "carro" | "moto";

export type Avaria = {
  id: string;
  x: number;
  y: number;
  desc: string;
};

export type ChecklistItemState = {
  checked: boolean;
  problema: boolean;
};

export type ChecklistFoto = { id: string; dataUrl: string };

export type Checklist = {
  id: string;
  os: string;
  tipo: ChecklistTipo;
  fase: ChecklistFase;
  createdAt: string;
  updatedAt: string;
  cliente: string;
  telefone?: string;
  placa: string;
  modelo: string;
  km: string;
  combustivel: number;
  itens: Record<string, ChecklistItemState>;
  avarias: Avaria[];
  observacoes: string;
  fotos: ChecklistFoto[];
  assinaturaDataUrl?: string;
  finalizado?: boolean;
};

const KEY = "om_checklists_v1";
const safe = () => typeof window !== "undefined";

export function listChecklists(): Checklist[] {
  if (!safe()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveChecklist(c: Checklist) {
  if (!safe()) return;
  const all = listChecklists().filter((x) => x.id !== c.id);
  all.unshift({ ...c, updatedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}

export function deleteChecklist(id: string) {
  if (!safe()) return;
  localStorage.setItem(
    KEY,
    JSON.stringify(listChecklists().filter((c) => c.id !== id)),
  );
}

export function findLastByPlaca(
  placa: string,
  fase?: ChecklistFase,
): Checklist | undefined {
  const p = (placa || "").toUpperCase().trim();
  if (!p) return undefined;
  return listChecklists().find(
    (c) => c.placa.toUpperCase() === p && (fase ? c.fase === fase : true),
  );
}

export function gerarNumeroOS(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `OS-${yy}${mm}${dd}-${rnd}`;
}

// === Seções do checklist de climatização ===
export type SecaoDef = { id: string; titulo: string; itens: string[] };

export const SECOES: SecaoDef[] = [
  {
    id: "avaliacao",
    titulo: "Avaliação do Local",
    itens: [
      "Local do equipamento definido",
      "Espaço para instalação verificado",
      "Acesso ao local confirmado",
      "Distância da condensadora avaliada",
      "Local da evaporadora definido",
    ],
  },
  {
    id: "instalacao",
    titulo: "Instalação",
    itens: [
      "Suporte instalado",
      "Evaporadora posicionada",
      "Condensadora posicionada",
      "Tubulação instalada",
      "Cabos elétricos instalados",
      "Dreno instalado",
    ],
  },
  {
    id: "eletrica",
    titulo: "Elétrica",
    itens: [
      "Tensão conferida",
      "Disjuntor verificado",
      "Circuito elétrico adequado",
      "Aterramento verificado",
      "Conexões elétricas conferidas",
    ],
  },
  {
    id: "refrigeracao",
    titulo: "Tubulação e Refrigeração",
    itens: [
      "Tubulação de cobre instalada",
      "Isolamento térmico instalado",
      "Flanges conferidos",
      "Vácuo realizado",
      "Pressão verificada",
      "Vazamento verificado",
    ],
  },
  {
    id: "teste",
    titulo: "Teste e Funcionamento",
    itens: [
      "Equipamento ligado",
      "Resfriamento testado",
      "Dreno testado",
      "Ruídos verificados",
      "Controle remoto testado",
      "Funcionamento final aprovado",
    ],
  },
  {
    id: "entrega",
    titulo: "Entrega",
    itens: [
      "Equipamento entregue funcionando",
      "Local limpo",
      "Orientações passadas ao cliente",
      "Serviço finalizado",
    ],
  },
];

export const SECAO_MOTO: SecaoDef = {
  id: "extras",
  titulo: "Itens Complementares",
  itens: [
    "Bomba de dreno instalada (se aplicável)",
    "Wi-Fi / automação configurada",
    "Nota fiscal e garantia entregues",
    "Agendamento da próxima manutenção",
  ],
};

export function getSecoes(tipo: ChecklistTipo): SecaoDef[] {
  return tipo === "moto" ? [...SECOES, SECAO_MOTO] : SECOES;
}


export function itemKey(secaoId: string, idx: number) {
  return `${secaoId}:${idx}`;
}
