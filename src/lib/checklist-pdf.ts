import { jsPDF } from "jspdf";
import type { Checklist } from "./checklist-storage";
import { getSecoes, itemKey } from "./checklist-storage";
import type { OficinaConfig, PdfOptions } from "./oficina-config";

// Paleta
const C = {
  bg: [13, 13, 13] as const,
  card: [26, 26, 26] as const,
  yellow: [56, 189, 248] as const,
  white: [255, 255, 255] as const,
  muted: [160, 160, 160] as const,
  red: [255, 68, 68] as const,
  redBg: [42, 0, 0] as const,
  blue: [74, 144, 217] as const,
  green: [76, 175, 80] as const,
  border: [51, 51, 51] as const,
  cardBorder: [42, 42, 42] as const,
};

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setText(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function paintBg(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  setFill(doc, C.bg);
  doc.rect(0, 0, W, H, "F");
  // Topo amarelo 3mm
  setFill(doc, C.yellow);
  doc.rect(0, 0, W, 1.2, "F");
}

function card(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { leftBar?: boolean; border?: boolean } = {},
) {
  setFill(doc, C.card);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  if (opts.leftBar !== false) {
    setFill(doc, C.yellow);
    doc.rect(x, y, 1.2, h, "F");
  }
  if (opts.border) {
    setDraw(doc, C.cardBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");
  }
}

function badge(
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  bg: readonly [number, number, number],
  fg: readonly [number, number, number],
) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const w = doc.getTextWidth(text) + 4;
  setFill(doc, bg);
  doc.roundedRect(x, y - 3, w, 4.5, 0.8, 0.8, "F");
  setText(doc, fg);
  doc.text(text, x + 2, y);
  return w;
}

function checkBox(
  doc: jsPDF,
  x: number,
  y: number,
  state: "ok" | "problema" | "vazio",
) {
  const s = 3;
  if (state === "ok") {
    setFill(doc, C.yellow);
    doc.roundedRect(x, y - s, s, s, 0.4, 0.4, "F");
    setDraw(doc, C.bg);
    doc.setLineWidth(0.4);
    doc.line(x + 0.7, y - 1.3, x + 1.3, y - 0.6);
    doc.line(x + 1.3, y - 0.6, x + 2.4, y - 2.4);
  } else if (state === "problema") {
    setFill(doc, C.red);
    doc.roundedRect(x, y - s, s, s, 0.4, 0.4, "F");
    setDraw(doc, C.bg);
    doc.setLineWidth(0.4);
    doc.line(x + 0.7, y - 1.3, x + 1.3, y - 0.6);
    doc.line(x + 1.3, y - 0.6, x + 2.4, y - 2.4);
  } else {
    setFill(doc, [42, 42, 42]);
    doc.roundedRect(x, y - s, s, s, 0.4, 0.4, "F");
    setDraw(doc, C.border);
    doc.setLineWidth(0.15);
    doc.roundedRect(x, y - s, s, s, 0.4, 0.4, "S");
  }
}

function ensurePage(doc: jsPDF, y: number, needed = 20): number {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 28) {
    doc.addPage();
    paintBg(doc);
    return 12;
  }
  return y;
}

function drawHeader(doc: jsPDF, c: Checklist, cfg: OficinaConfig) {
  const W = doc.internal.pageSize.getWidth();
  // Barra amarela esquerda
  setFill(doc, C.yellow);
  doc.rect(0, 0, 1.6, 36, "F");

  // Logo box
  if (cfg.logoDataUrl) {
    try {
      doc.addImage(cfg.logoDataUrl, "PNG", 6, 6, 28, 24);
    } catch {
      // ignora
    }
  } else {
    setDraw(doc, C.border);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0);
    doc.roundedRect(6, 6, 28, 24, 1, 1, "S");
    doc.setLineDashPattern([], 0);
    setText(doc, C.muted);
    doc.setFontSize(7);
    doc.text("LOGO", 16, 19);
  }

  // Texto header
  setText(doc, C.yellow);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CHECKLIST DE INSPEÇÃO", 38, 12);

  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const data = new Date(c.createdAt).toLocaleString("pt-BR");
  doc.text(`OS ${c.os}  ·  ${data}`, 38, 17);

  // Badge fase
  const bgFase = c.fase === "entrada" ? [15, 42, 74] : [15, 61, 31];
  const fgFase = c.fase === "entrada" ? C.blue : C.green;
  badge(
    doc,
    38,
    24,
    c.fase === "entrada" ? "ENTRADA" : "SAÍDA",
    bgFase as [number, number, number],
    fgFase,
  );

  // Oficina nome + tel à direita
  setText(doc, C.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const nome = cfg.nome || "Meus Serviços";
  doc.text(nome, W - 6, 12, { align: "right" });
  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const sub = [cfg.telefone, cfg.endereco].filter(Boolean).join("  ·  ");
  if (sub) doc.text(sub, W - 6, 17, { align: "right" });
  if (cfg.cnpj) doc.text(`CNPJ ${cfg.cnpj}`, W - 6, 21, { align: "right" });
  if (cfg.slogan) {
    doc.setFont("helvetica", "italic");
    setText(doc, C.yellow);
    doc.text(cfg.slogan, W - 6, 25, { align: "right" });
  }

  // Linha divisória
  setDraw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(6, 34, W - 6, 34);
}

function drawVeiculo(doc: jsPDF, c: Checklist, y: number): number {
  const W = doc.internal.pageSize.getWidth();
  const h = 26;
  card(doc, 6, y, W - 12, h, { border: true });
  setText(doc, C.yellow);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DADOS DA INSTALAÇÃO", 10, y + 5);

  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const labels: [string, string, number, number][] = [
    ["CLIENTE", c.cliente || "—", 10, y + 10],
    ["TELEFONE", c.telefone || "—", 80, y + 10],
    ["LOCAL", c.placa || "—", 10, y + 17],
    ["EQUIPAMENTO", c.modelo || "—", 50, y + 17],
    ["KM", c.km || "—", 110, y + 17],
  ];
  for (const [l, v, x, ly] of labels) {
    setText(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(l, x, ly);
    setText(doc, C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(String(v).slice(0, 32), x, ly + 4);
  }

  // Barra combustível
  const bx = 140;
  const by = y + 21;
  const bw = W - 12 - (bx - 6) - 4;
  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`COMBUSTÍVEL  ${c.combustivel}%`, bx, y + 17);
  setFill(doc, [42, 42, 42]);
  doc.roundedRect(bx, by, bw, 3, 0.6, 0.6, "F");
  setFill(doc, C.yellow);
  doc.roundedRect(bx, by, (bw * c.combustivel) / 100, 3, 0.6, 0.6, "F");

  return y + h + 4;
}

function drawSections(
  doc: jsPDF,
  c: Checklist,
  y: number,
  opts: PdfOptions,
): number {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 12 - 4) / 2;
  const secoes = getSecoes(c.tipo);
  let col = 0;
  let yLeft = y;
  let yRight = y;

  for (const sec of secoes) {
    const itensFull = sec.itens.map((txt, idx) => ({
      txt,
      st: c.itens[itemKey(sec.id, idx)],
    }));
    let itens = itensFull;
    if (opts.apenasProblemas) itens = itens.filter((i) => i.st?.problema);
    else if (!opts.showNaoVerificados)
      itens = itens.filter((i) => i.st?.checked || i.st?.problema);
    if (!itens.length) continue;

    const lineH = 4.6;
    const titleH = 7;
    const padding = 6;
    const h = titleH + itens.length * lineH + padding;
    let cy = col === 0 ? yLeft : yRight;
    const x = col === 0 ? 6 : 10 + colW;

    if (cy + h > doc.internal.pageSize.getHeight() - 36) {
      doc.addPage();
      paintBg(doc);
      yLeft = 12;
      yRight = 12;
      cy = 12;
    }

    card(doc, x, cy, colW, h, { border: true });
    setText(doc, C.yellow);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(sec.titulo.toUpperCase(), x + 4, cy + 5);
    setDraw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.line(x + 4, cy + 6.5, x + colW - 4, cy + 6.5);

    let iy = cy + 11;
    for (const it of itens) {
      const state: "ok" | "problema" | "vazio" = it.st?.problema
        ? "problema"
        : it.st?.checked
          ? "ok"
          : "vazio";
      checkBox(doc, x + 4, iy, state);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      if (state === "problema") setText(doc, C.red);
      else if (state === "ok") setText(doc, C.white);
      else setText(doc, C.muted);
      const txt = doc.splitTextToSize(it.txt, colW - 14)[0] as string;
      doc.text(txt, x + 8.5, iy - 0.4);
      iy += lineH;
    }

    if (col === 0) yLeft = cy + h + 3;
    else yRight = cy + h + 3;
    col = col === 0 ? 1 : 0;
  }

  return Math.max(yLeft, yRight);
}

function drawObservacoes(doc: jsPDF, c: Checklist, y: number): number {
  if (!c.observacoes?.trim()) return y;
  const W = doc.internal.pageSize.getWidth();
  const splitted = doc.splitTextToSize(c.observacoes, W - 24) as string[];
  const h = 10 + splitted.length * 4;
  y = ensurePage(doc, y, h + 4);
  card(doc, 6, y, W - 12, h, { border: true });
  setText(doc, C.yellow);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("OBSERVAÇÕES", 10, y + 5);
  setText(doc, C.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(splitted, 10, y + 10);
  return y + h + 4;
}

function drawAssinaturas(
  doc: jsPDF,
  c: Checklist,
  y: number,
  showAssinatura: boolean,
): number {
  const W = doc.internal.pageSize.getWidth();
  const h = 30;
  y = ensurePage(doc, y, h + 4);
  const colW = (W - 12 - 8) / 3;

  const blocos: { titulo: string; render?: () => void }[] = [
    { titulo: "RESPONSÁVEL TÉCNICO" },
    {
      titulo: "ASSINATURA DO CLIENTE",
      render:
        showAssinatura && c.assinaturaDataUrl
          ? () => {
              try {
                doc.addImage(
                  c.assinaturaDataUrl!,
                  "PNG",
                  6 + colW + 4 + 3,
                  y + 8,
                  colW - 6,
                  16,
                );
              } catch {
                // ignore
              }
            }
          : undefined,
    },
    { titulo: "DATA" },
  ];

  blocos.forEach((b, i) => {
    const x = 6 + i * (colW + 4);
    card(doc, x, y, colW, h, { border: true, leftBar: false });
    setDraw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.line(x + 4, y + h - 8, x + colW - 4, y + h - 8);
    setText(doc, C.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(b.titulo, x + 4, y + h - 4);
    if (i === 2) {
      setText(doc, C.white);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(new Date().toLocaleDateString("pt-BR"), x + 4, y + h - 12);
    }
    b.render?.();
  });

  return y + h + 4;
}

function drawFooter(doc: jsPDF, c: Checklist) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setFill(doc, C.yellow);
    doc.rect(0, H - 18, W, 0.6, "F");
    setFill(doc, C.bg);
    doc.rect(0, H - 17, W, 17, "F");

    // contadores
    const secoes = getSecoes(c.tipo);
    let total = 0;
    let verif = 0;
    let probs = 0;
    for (const sec of secoes) {
      sec.itens.forEach((_, idx) => {
        total++;
        const st = c.itens[itemKey(sec.id, idx)];
        if (st?.checked) verif++;
        if (st?.problema) probs++;
      });
    }

    setText(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Itens verificados: ${verif}/${total}`, 6, H - 10);
    if (probs > 0) {
      setText(doc, C.red);
      doc.setFont("helvetica", "bold");
      doc.text(`⚠ ${probs} ${probs === 1 ? "item requer" : "itens requerem"} atenção`, 6, H - 5);
    }

    setText(doc, C.yellow);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("OrçaAr Condicionado Pro — Gestão Profissional", W / 2, H - 10, { align: "center" });
    setText(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("orcaarcondicionadopro.lovable.app", W / 2, H - 5, { align: "center" });

    setText(doc, C.muted);
    doc.setFontSize(7);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      W - 6,
      H - 10,
      { align: "right" },
    );
    doc.text(`Pág. ${p}/${pages}`, W - 6, H - 5, { align: "right" });
  }
}

function fileName(c: Checklist) {
  const placa = (c.placa || "SEMPLACA").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const d = new Date(c.createdAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const os = (c.os || "OS").replace(/[^A-Z0-9]/gi, "");
  return `checklist-${placa}-${dd}${mm}${yyyy}-${os}.pdf`;
}

export function gerarChecklistPdfPro(
  c: Checklist,
  cfg: OficinaConfig,
  opts: PdfOptions,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  paintBg(doc);
  drawHeader(doc, c, cfg);
  let y = 40;
  y = drawVeiculo(doc, c, y);
  y = drawSections(doc, c, y, opts);
  if (opts.showObservacoes) y = drawObservacoes(doc, c, y);
  y = drawAssinaturas(doc, c, y, opts.showAssinatura);
  drawFooter(doc, c);
  doc.save(fileName(c));
}