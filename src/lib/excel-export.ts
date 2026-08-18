import * as XLSX from "xlsx";
import type { Orcamento } from "./storage";

const STATUS_LABEL: Record<Orcamento["status"], string> = {
  enviado: "Em Aberto",
  aprovado: "Aprovado",
  concluido: "Concluído",
};

const STATUS_FILL: Record<Orcamento["status"], string> = {
  enviado: "FFF3CD", // amarelo claro
  aprovado: "D4EDDA", // verde claro
  concluido: "D6E4F5", // azul claro
};

const STATUS_FONT: Record<Orcamento["status"], string> = {
  enviado: "856404",
  aprovado: "155724",
  concluido: "0B3D91",
};

const HEADERS = [
  "Nº do Orçamento",
  "Data de Criação",
  "Nome do Cliente",
  "Telefone",
  "Instalação",
  "Modelo",
  "Status",
  "Subtotal Peças (R$)",
  "Mão de Obra (R$)",
  "Total (R$)",
  "Lucro Estimado (R$)",
  "Margem Aplicada (%)",
  "Condição de Pagamento",
];

function condPagamento(o: Orcamento): string {
  const p = o.parcelas ?? 1;
  return p <= 1 ? "À vista" : `${p}x`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fileNameDate(d: Date) {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function exportOrcamentosToExcel(items: Orcamento[]) {
  // Sort by createdAt asc so numbering matches list
  const sorted = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const numberMap = new Map<string, number>();
  sorted.forEach((o, i) => numberMap.set(o.id, i + 1));

  const rows: (string | number)[][] = [HEADERS];

  items.forEach((o) => {
    const num = String(numberMap.get(o.id) ?? 0).padStart(4, "0");
    rows.push([
      `#${num}`,
      fmtDate(new Date(o.createdAt)),
      o.cliente.nome || "",
      o.cliente.telefone || "",
      o.veiculo.marcaModelo || "",
      o.veiculo.placa || "",
      STATUS_LABEL[o.status],
      o.totals.pecas || 0,
      o.totals.maoObra || 0,
      o.totals.total || 0,
      o.totals.lucro || 0,
      o.margem || 0,
      condPagamento(o),
    ]);
  });

  // Totals row
  const sum = (k: "pecas" | "maoObra" | "total" | "lucro") =>
    items.reduce((s, o) => s + (o.totals[k] || 0), 0);
  const totalsRow: (string | number)[] = [
    "TOTAL GERAL",
    "",
    "",
    "",
    "",
    "",
    "",
    sum("pecas"),
    sum("maoObra"),
    sum("total"),
    sum("lucro"),
    "",
    "",
  ];
  rows.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const widths = HEADERS.map((h, i) => {
    let max = h.length;
    rows.slice(1).forEach((r) => {
      const v = r[i];
      const len =
        typeof v === "number"
          ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }).length + 4
          : String(v ?? "").length;
      if (len > max) max = len;
    });
    return { wch: Math.min(Math.max(max + 2, 12), 40) };
  });
  ws["!cols"] = widths;

  // Cell-level formatting (header, zebra, currency, status colors, totals)
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  const currencyCols = new Set([7, 8, 9, 10]); // 0-based indexes
  const pctCol = 11;
  const statusCol = 6;
  const lastRow = range.e.r;

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1D6F42" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "1D6F42" } },
      bottom: { style: "thin", color: { rgb: "1D6F42" } },
    },
  };

  const brlFmt = '"R$" #,##0.00;[Red]"R$" -#,##0.00';
  const pctFmt = '0.0"%"';

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = cell.s || {};

      if (R === 0) {
        cell.s = headerStyle;
        continue;
      }

      const isTotals = R === lastRow;
      const zebra = R % 2 === 0;

      cell.s = {
        font: { color: { rgb: "111111" }, bold: isTotals },
        fill: {
          fgColor: { rgb: isTotals ? "FFE89A" : zebra ? "F5F5F5" : "FFFFFF" },
        },
        alignment: { vertical: "center" },
      };

      if (currencyCols.has(C)) {
        cell.z = brlFmt;
        cell.s.alignment = { horizontal: "right", vertical: "center" };
      } else if (C === pctCol && typeof cell.v === "number") {
        cell.z = pctFmt;
        cell.s.alignment = { horizontal: "right", vertical: "center" };
      }

      if (!isTotals && C === statusCol) {
        const orc = items[R - 1];
        if (orc) {
          cell.s.fill = { fgColor: { rgb: STATUS_FILL[orc.status] } };
          cell.s.font = {
            bold: true,
            color: { rgb: STATUS_FONT[orc.status] },
          };
          cell.s.alignment = { horizontal: "center", vertical: "center" };
        }
      }
    }
  }

  // Freeze header
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orçamentos");
  const filename = `OrcaArCondicionadoPro_Orcamentos_${fileNameDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, filename);
}