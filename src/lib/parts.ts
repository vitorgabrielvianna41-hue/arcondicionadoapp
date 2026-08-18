export type PartItem = {
  key: string;
  name: string;
  qty: number;
  unit: string;
};

export type ServiceDef = {
  id: string;
  name: string;
  parts: (ctx: { motorL?: number; cilindros?: number }) => PartItem[];
};

export const DEFAULT_PRICES: Record<string, number> = {
  tubo_cobre_14: 22,
  tubo_cobre_38: 28,
  tubo_cobre_12: 36,
  tubo_cobre_58: 45,
  isolamento_termico: 6.5,
  cabo_eletrico: 5.5,
  cabo_pp: 9.5,
  suporte_condensadora: 55,
  suporte_reforcado: 95,
  buchas_parafusos: 12,
  dreno: 8,
  mangueira_dreno: 6,
  fita_pvc: 9,
  fita_isolamento: 8,
  fita_aluminizada: 18,
  canaleta: 24,
  conector_eletrico: 4,
  disjuntor: 28,
  tomada: 14,
  plugue: 10,
  gas_refrigerante: 90,
  valvula_registro: 45,
  filtro: 35,
  capacitor: 48,
  sensor: 42,
  rele: 38,
  contator: 65,
  helice: 70,
  motor_ventilador: 220,
  placa_eletronica: 380,
  servico_personalizado: 0,
};

export const PART_LABELS: Record<string, string> = {
  tubo_cobre_14: 'Tubo de cobre 1/4"',
  tubo_cobre_38: 'Tubo de cobre 3/8"',
  tubo_cobre_12: 'Tubo de cobre 1/2"',
  tubo_cobre_58: 'Tubo de cobre 5/8"',
  isolamento_termico: "Isolamento térmico",
  cabo_eletrico: "Cabo elétrico",
  cabo_pp: "Cabo PP",
  suporte_condensadora: "Suporte para condensadora",
  suporte_reforcado: "Suporte reforçado",
  buchas_parafusos: "Buchas e parafusos",
  dreno: "Dreno",
  mangueira_dreno: "Mangueira para dreno",
  fita_pvc: "Fita PVC",
  fita_isolamento: "Fita de isolamento",
  fita_aluminizada: "Fita aluminizada",
  canaleta: "Canaleta",
  conector_eletrico: "Conector elétrico",
  disjuntor: "Disjuntor",
  tomada: "Tomada",
  plugue: "Plugue",
  gas_refrigerante: "Fluido refrigerante / gás",
  valvula_registro: "Válvula / registro",
  filtro: "Filtro",
  capacitor: "Capacitor",
  sensor: "Sensor",
  rele: "Relé",
  contator: "Contator",
  helice: "Hélice",
  motor_ventilador: "Motor",
  placa_eletronica: "Placa eletrônica",
  servico_personalizado: "Serviço personalizado",
};

/** Unidade padrão por material (metro, par, kg, un). */
export const PART_UNITS: Record<string, string> = {
  tubo_cobre_14: "m",
  tubo_cobre_38: "m",
  tubo_cobre_12: "m",
  tubo_cobre_58: "m",
  isolamento_termico: "m",
  cabo_eletrico: "m",
  cabo_pp: "m",
  canaleta: "m",
  mangueira_dreno: "m",
  dreno: "m",
  suporte_condensadora: "par",
  suporte_reforcado: "par",
  gas_refrigerante: "kg",
  servico_personalizado: "serv",
};

export const unitFor = (key: string) => PART_UNITS[key] ?? "un";

export const SERVICES: ServiceDef[] = [
  {
    id: "instalacao_split",
    name: "Instalação de Ar-Condicionado",
    parts: () => [
      { key: "tubo_cobre_14", name: PART_LABELS.tubo_cobre_14, qty: 3, unit: "m" },
      { key: "tubo_cobre_38", name: PART_LABELS.tubo_cobre_38, qty: 3, unit: "m" },
      { key: "isolamento_termico", name: PART_LABELS.isolamento_termico, qty: 6, unit: "m" },
      { key: "cabo_pp", name: PART_LABELS.cabo_pp, qty: 4, unit: "m" },
      { key: "suporte_condensadora", name: PART_LABELS.suporte_condensadora, qty: 1, unit: "par" },
      { key: "mangueira_dreno", name: PART_LABELS.mangueira_dreno, qty: 3, unit: "m" },
    ],
  },
  {
    id: "instalacao_inverter",
    name: "Instalação de Ar-Condicionado Inverter",
    parts: () => [
      { key: "tubo_cobre_14", name: PART_LABELS.tubo_cobre_14, qty: 4, unit: "m" },
      { key: "tubo_cobre_12", name: PART_LABELS.tubo_cobre_12, qty: 4, unit: "m" },
      { key: "isolamento_termico", name: PART_LABELS.isolamento_termico, qty: 8, unit: "m" },
      { key: "disjuntor", name: PART_LABELS.disjuntor, qty: 1, unit: "un" },
      { key: "suporte_reforcado", name: PART_LABELS.suporte_reforcado, qty: 1, unit: "par" },
    ],
  },
  {
    id: "multi_split",
    name: "Instalação Multi Split",
    parts: () => [
      { key: "tubo_cobre_14", name: PART_LABELS.tubo_cobre_14, qty: 10, unit: "m" },
      { key: "tubo_cobre_38", name: PART_LABELS.tubo_cobre_38, qty: 10, unit: "m" },
      { key: "isolamento_termico", name: PART_LABELS.isolamento_termico, qty: 20, unit: "m" },
      { key: "cabo_pp", name: PART_LABELS.cabo_pp, qty: 15, unit: "m" },
      { key: "suporte_reforcado", name: PART_LABELS.suporte_reforcado, qty: 1, unit: "par" },
    ],
  },
  {
    id: "manutencao_preventiva",
    name: "Manutenção Preventiva",
    parts: () => [
      { key: "fita_pvc", name: PART_LABELS.fita_pvc, qty: 1, unit: "un" },
      { key: "filtro", name: PART_LABELS.filtro, qty: 1, unit: "un" },
    ],
  },
  {
    id: "higienizacao",
    name: "Higienização",
    parts: () => [
      { key: "servico_personalizado", name: "Produtos de higienização", qty: 1, unit: "serv" },
    ],
  },
  {
    id: "recarga_gas",
    name: "Recarga de Gás",
    parts: () => [
      { key: "gas_refrigerante", name: PART_LABELS.gas_refrigerante, qty: 1, unit: "kg" },
    ],
  },
  {
    id: "troca_componentes",
    name: "Troca de Componentes",
    parts: () => [
      { key: "capacitor", name: PART_LABELS.capacitor, qty: 1, unit: "un" },
      { key: "contator", name: PART_LABELS.contator, qty: 1, unit: "un" },
    ],
  },
  {
    id: "remanejamento",
    name: "Remanejamento de Ar-Condicionado",
    parts: () => [
      { key: "tubo_cobre_14", name: PART_LABELS.tubo_cobre_14, qty: 3, unit: "m" },
      { key: "isolamento_termico", name: PART_LABELS.isolamento_termico, qty: 6, unit: "m" },
      { key: "gas_refrigerante", name: PART_LABELS.gas_refrigerante, qty: 1, unit: "kg" },
    ],
  },
  {
    id: "personalizado",
    name: "Serviço Personalizado",
    parts: () => [],
  },
];

export const getService = (id: string) => SERVICES.find((s) => s.id === id);

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
