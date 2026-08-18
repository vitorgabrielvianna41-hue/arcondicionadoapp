import { jsPDF } from "jspdf";
import type { Orcamento } from "./storage";
import { brl } from "./parts";
import {
  loadOficina,
  loadOrcamentoPdf,
  type OficinaConfig,
  type OrcamentoPdfConfig,
} from "./oficina-config";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fileDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${d.getFullYear()}`;
}

export async function gerarOrcamentoPDF(
  o: Orcamento,
  opts?: { oficina?: OficinaConfig; pdf?: OrcamentoPdfConfig },
) {
  const oficina = opts?.oficina ?? loadOficina();
  const cfg = opts?.pdf ?? loadOrcamentoPdf();
  const modelo = cfg.modelo ?? "profissional";
  if (modelo === "classico") return gerarClassico(o, oficina, cfg);
  if (modelo === "minimalista") return gerarMinimalista(o, oficina, cfg);
  const [cR, cG, cB] = hexToRgb(cfg.corDestaque || "#38BDF8");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ===== HEADER =====
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, W, 32, "F");

  // logo
  if (cfg.logoDataUrl) {
    try {
      doc.addImage(cfg.logoDataUrl, "PNG", 10, 6, 22, 22);
    } catch {}
  } else {
    doc.setDrawColor(cR, cG, cB);
    doc.setLineDashPattern([1, 1], 0);
    doc.rect(10, 6, 22, 22);
    doc.setLineDashPattern([], 0);
  }

  doc.setTextColor(cR, cG, cB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(oficina.nome || "OrçaAr Condicionado", W - 10, 14, { align: "right" });
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const linhaOf = [oficina.endereco, oficina.telefone, oficina.cnpj, oficina.email]
    .filter(Boolean)
    .join(" • ");
  doc.text(linhaOf, W - 10, 22, { align: "right" });
  if (oficina.website) doc.text(oficina.website, W - 10, 26, { align: "right" });

  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(0.8);
  doc.line(0, 32, W, 32);
  doc.setLineWidth(0.2);

  let y = 40;

  // ===== CARD CLIENTE/INSTALAÇÃO =====
  const numero = "OS" + o.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const dataStr = new Date(o.createdAt).toLocaleDateString("pt-BR");

  doc.setFillColor(26, 26, 26);
  doc.roundedRect(10, y, W - 20, cfg.mostrarVeiculo ? 28 : 18, 2, 2, "F");
  doc.setFillColor(cR, cG, cB);
  doc.rect(10, y, 1.2, cfg.mostrarVeiculo ? 28 : 18, "F");

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", 14, y + 5);
  doc.text("TELEFONE", W / 2 + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(o.cliente.nome || "—", 14, y + 10);
  doc.text(o.cliente.telefone || "—", W / 2 + 4, y + 10);

  if (cfg.mostrarVeiculo) {
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("EQUIPAMENTO", 14, y + 16);
    doc.text("LOCAL DO SERVIÇO", W / 2 + 4, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(
      `${o.veiculo.marcaModelo || "—"} ${o.veiculo.ano || ""}`.trim(),
      14,
      y + 21,
    );
    doc.text(o.veiculo.placa || "—", W / 2 + 4, y + 21);
  }

  // OS + data no canto
  doc.setTextColor(cR, cG, cB);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const right = W - 14;
  doc.text(`Data: ${dataStr}`, right, y + 5, { align: "right" });
  if (cfg.mostrarNumeroOS) doc.text(numero, right, y + 10, { align: "right" });

  y += cfg.mostrarVeiculo ? 34 : 24;

  const ensure = (need: number) => {
    if (y + need > H - 25) {
      doc.addPage();
      y = 15;
    }
  };

  const drawTableHeader = (cols: { label: string; x: number; w: number; align?: "left" | "right" | "center" }[]) => {
    doc.setFillColor(cR, cG, cB);
    doc.rect(10, y, W - 20, 7, "F");
    doc.setTextColor(13, 13, 13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const c of cols) {
      const tx = c.align === "right" ? c.x + c.w - 2 : c.align === "center" ? c.x + c.w / 2 : c.x + 2;
      doc.text(c.label, tx, y + 4.7, { align: c.align ?? "left" });
    }
    y += 7;
  };

  // ===== PEÇAS =====
  if (o.parts.length) {
    ensure(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(cR, cG, cB);
    doc.text("PEÇAS / MATERIAIS", 10, y);
    y += 4;

    const cols = [
      { label: "ITEM", x: 10, w: 35 },
      { label: "DESCRIÇÃO", x: 45, w: 95 },
      { label: "QTD", x: 140, w: 15, align: "center" as const },
      { label: "UNIT.", x: 155, w: 20, align: "right" as const },
      { label: "SUBTOTAL", x: 175, w: W - 185, align: "right" as const },
    ];
    drawTableHeader(cols);

    let zebra = false;
    let subPecas = 0;
    for (const p of o.parts) {
      const sub = p.price * p.qty;
      subPecas += sub;
      const desc = (p.descricao || "").trim();
      const descLines = desc ? doc.splitTextToSize(desc, 93) : [];
      const rowH = Math.max(8, 5 + descLines.length * 3.5);
      ensure(rowH);
      doc.setFillColor(zebra ? 34 : 26, zebra ? 34 : 26, zebra ? 34 : 26);
      doc.rect(10, y, W - 20, rowH, "F");
      zebra = !zebra;
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(p.name || "—", 33)[0], 12, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      if (descLines.length) doc.text(descLines, 47, y + 5);
      else doc.text("—", 47, y + 5);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`${p.qty} ${p.unit}`, 140 + 7.5, y + 5, { align: "center" });
      doc.text(brl(p.price), 175 - 2, y + 5, { align: "right" });
      doc.setTextColor(cR, cG, cB);
      doc.setFont("helvetica", "bold");
      doc.text(brl(sub), W - 12, y + 5, { align: "right" });
      y += rowH;
    }
    y += 2;
    doc.setTextColor(cR, cG, cB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Subtotal peças: ${brl(subPecas)}`, W - 12, y + 3, { align: "right" });
    y += 8;
  }

  // ===== SERVIÇOS =====
  const servicos =
    o.servicosDetalhados && o.servicosDetalhados.length
      ? o.servicosDetalhados
      : o.totals.maoObra > 0
      ? [{ nome: o.servicoNome || "Mão de obra", descricao: "", valor: o.totals.maoObra }]
      : [];

  if (servicos.length) {
    ensure(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(cR, cG, cB);
    doc.text("SERVIÇOS / MÃO DE OBRA", 10, y);
    y += 4;

    drawTableHeader([
      { label: "SERVIÇO", x: 10, w: 55 },
      { label: "DESCRIÇÃO", x: 65, w: 110 },
      { label: "VALOR", x: 175, w: W - 185, align: "right" as const },
    ]);

    let zebra = false;
    let subServ = 0;
    for (const s of servicos) {
      subServ += s.valor;
      const desc = (s.descricao || "").trim();
      const descLines = desc ? doc.splitTextToSize(desc, 108) : ["—"];
      const rowH = Math.max(8, 5 + descLines.length * 3.5);
      ensure(rowH);
      doc.setFillColor(zebra ? 34 : 26, zebra ? 34 : 26, zebra ? 34 : 26);
      doc.rect(10, y, W - 20, rowH, "F");
      zebra = !zebra;
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(s.nome || "—", 53)[0], 12, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(descLines, 67, y + 5);
      doc.setTextColor(cR, cG, cB);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(brl(s.valor), W - 12, y + 5, { align: "right" });
      y += rowH;
    }
    y += 2;
    doc.setTextColor(cR, cG, cB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Subtotal mão de obra: ${brl(subServ)}`, W - 12, y + 3, { align: "right" });
    y += 8;
  }

  // ===== TOTALIZADOR =====
  ensure(30);
  const boxW = 90;
  const boxX = W - 10 - boxW;
  doc.setFillColor(26, 26, 26);
  doc.setDrawColor(cR, cG, cB);
  doc.roundedRect(boxX, y, boxW, 28, 2, 2, "FD");
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Subtotal peças:", boxX + 4, y + 6);
  doc.text("Subtotal mão de obra:", boxX + 4, y + 11);
  doc.setTextColor(255, 255, 255);
  doc.text(brl(o.totals.pecas), boxX + boxW - 4, y + 6, { align: "right" });
  doc.text(brl(o.totals.maoObra), boxX + boxW - 4, y + 11, { align: "right" });
  doc.setDrawColor(60, 60, 60);
  doc.line(boxX + 3, y + 14, boxX + boxW - 3, y + 14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL GERAL:", boxX + 4, y + 22);
  doc.setTextColor(cR, cG, cB);
  doc.setFontSize(14);
  doc.text(brl(o.totals.total), boxX + boxW - 4, y + 22, { align: "right" });
  y += 32;

  // ===== OBSERVAÇÕES =====
  if (cfg.mostrarObservacoes && o.observacoes && o.observacoes.trim()) {
    ensure(20);
    doc.setFillColor(26, 26, 26);
    const txt = o.observacoes.trim();
    const lines = doc.splitTextToSize(txt, W - 30);
    const boxH = 8 + lines.length * 4;
    doc.roundedRect(10, y, W - 20, boxH, 2, 2, "F");
    doc.setFillColor(cR, cG, cB);
    doc.rect(10, y, 1.2, boxH, "F");
    doc.setTextColor(cR, cG, cB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("OBSERVAÇÕES", 14, y + 5);
    doc.setTextColor(212, 212, 216);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lines, 14, y + 10);
    y += boxH + 4;
  }

  // ===== RODAPÉ =====
  const footY = H - 18;
  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(0.6);
  doc.line(0, footY, W, footY);
  doc.setLineWidth(0.2);
  doc.setFillColor(13, 13, 13);
  doc.rect(0, footY, W, 18, "F");
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (cfg.rodapeTexto && cfg.rodapeTexto.trim()) {
    const lines = doc.splitTextToSize(cfg.rodapeTexto.trim(), W - 60);
    doc.text(lines, 10, footY + 5);
  }
  if (cfg.mostrarValidade) {
    doc.setFont("helvetica", "italic");
    doc.text(
      "Orçamento válido por 7 dias a partir da data de emissão.",
      10,
      footY + 14,
    );
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.text("gerado por OrçaAr Condicionado Pro", W - 10, footY + 14, { align: "right" });

  const placa = (o.cliente.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  const filename = `orcamento-${placa}-${fileDate(new Date(o.createdAt))}-${numero}.pdf`;
  doc.save(filename);
}
/* ===================== MODELO CLÁSSICO (fundo branco) ===================== */
async function gerarClassico(o: Orcamento, oficina: OficinaConfig, cfg: OrcamentoPdfConfig) {
  const [cR, cG, cB] = hexToRgb(cfg.corDestaque || "#38BDF8");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // header branco, logo centralizada
  let y = 12;
  if (cfg.logoDataUrl) {
    try { doc.addImage(cfg.logoDataUrl, "PNG", W / 2 - 12, y, 24, 24); } catch {}
    y += 26;
  }
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(oficina.nome || "OrçaAr Condicionado", W / 2, y + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const sub = [oficina.endereco, oficina.telefone, oficina.cnpj].filter(Boolean).join(" • ");
  if (sub) doc.text(sub, W / 2, y + 10, { align: "center" });
  y += 14;
  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(1);
  doc.line(15, y, W - 15, y);
  doc.setLineWidth(0.2);
  y += 8;

  // dados cliente/veiculo
  const numero = "OS" + o.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const dataStr = new Date(o.createdAt).toLocaleDateString("pt-BR");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Cliente: `, 15, y);
  doc.setFont("helvetica", "normal");
  doc.text(o.cliente.nome || "—", 32, y);
  doc.setFont("helvetica", "bold");
  doc.text(`Telefone: `, W / 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(o.cliente.telefone || "—", W / 2 + 20, y);
  y += 6;
  if (cfg.mostrarVeiculo) {
    doc.setFont("helvetica", "bold");
    doc.text(`Equipamento: `, 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${o.veiculo.marcaModelo || "—"} ${o.veiculo.ano || ""}`.trim(), 38, y);
    doc.setFont("helvetica", "bold");
    doc.text(`Local: `, W / 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(o.veiculo.placa || "—", W / 2 + 16, y);
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`Data: `, 15, y);
  doc.setFont("helvetica", "normal");
  doc.text(dataStr, 27, y);
  if (cfg.mostrarNumeroOS) {
    doc.setFont("helvetica", "bold");
    doc.text(`Nº: `, W / 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(numero, W / 2 + 10, y);
  }
  y += 8;

  const ensure = (n: number) => { if (y + n > H - 25) { doc.addPage(); y = 15; } };

  const drawTable = (titulo: string, headers: string[], rows: string[][], aligns: ("left"|"right"|"center")[]) => {
    ensure(20);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo, 15, y);
    y += 3;
    const colW = [80, 25, 30, 35];
    if (headers.length === 3) { colW[0] = 105; colW.splice(1, 2); colW.push(30); }
    const xs: number[] = [15];
    for (let i = 0; i < headers.length - 1; i++) xs.push(xs[i] + colW[i]);
    const tableW = W - 30;
    // header
    doc.setDrawColor(cR, cG, cB);
    doc.setLineWidth(0.6);
    doc.line(15, y + 1, 15 + tableW, y + 1);
    y += 5;
    doc.setFontSize(9);
    headers.forEach((h, i) => {
      const a = aligns[i];
      const tx = a === "right" ? xs[i] + colW[i] - 2 : a === "center" ? xs[i] + colW[i] / 2 : xs[i];
      doc.text(h, tx, y, { align: a });
    });
    y += 2;
    doc.setLineWidth(0.2);
    doc.setDrawColor(180, 180, 180);
    doc.line(15, y, 15 + tableW, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      ensure(7);
      r.forEach((cell, i) => {
        const a = aligns[i];
        const tx = a === "right" ? xs[i] + colW[i] - 2 : a === "center" ? xs[i] + colW[i] / 2 : xs[i];
        const lines = doc.splitTextToSize(cell, colW[i] - 3);
        doc.text(lines[0] ?? "", tx, y, { align: a });
      });
      y += 5;
      doc.setDrawColor(230, 230, 230);
      doc.line(15, y, 15 + tableW, y);
      y += 2;
    });
    y += 4;
  };

  if (o.parts.length) {
    drawTable(
      "Peças / Materiais",
      ["Descrição", "Qtd", "Unit.", "Subtotal"],
      o.parts.map((p) => [p.name, `${p.qty} ${p.unit}`, brl(p.price), brl(p.price * p.qty)]),
      ["left", "center", "right", "right"],
    );
  }
  const servicos = o.servicosDetalhados?.length
    ? o.servicosDetalhados
    : o.totals.maoObra > 0
      ? [{ nome: o.servicoNome || "Mão de obra", descricao: "", valor: o.totals.maoObra }]
      : [];
  if (servicos.length) {
    drawTable(
      "Serviços / Mão de Obra",
      ["Descrição", "Valor"],
      servicos.map((s) => [s.nome + (s.descricao ? ` — ${s.descricao}` : ""), brl(s.valor)]),
      ["left", "right"],
    );
  }

  // totalizador
  ensure(20);
  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(0.8);
  doc.line(W - 95, y, W - 15, y);
  y += 5;
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Peças:", W - 95, y);
  doc.text(brl(o.totals.pecas), W - 15, y, { align: "right" });
  y += 5;
  doc.text("Mão de obra:", W - 95, y);
  doc.text(brl(o.totals.maoObra), W - 15, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL:", W - 95, y);
  doc.setTextColor(cR, cG, cB);
  doc.text(brl(o.totals.total), W - 15, y, { align: "right" });
  y += 10;

  if (cfg.mostrarObservacoes && o.observacoes?.trim()) {
    ensure(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text("Observações", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(o.observacoes.trim(), W - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 4;
  }

  // rodape
  const footY = H - 16;
  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(0.5);
  doc.line(15, footY, W - 15, footY);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  if (cfg.rodapeTexto?.trim()) {
    const lines = doc.splitTextToSize(cfg.rodapeTexto.trim(), W - 30);
    doc.text(lines, 15, footY + 5);
  }

  const placa = (o.cliente.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  doc.save(`orcamento-${placa}-${fileDate(new Date(o.createdAt))}-${numero}.pdf`);
}

/* ===================== MODELO MINIMALISTA ===================== */
async function gerarMinimalista(o: Orcamento, oficina: OficinaConfig, cfg: OrcamentoPdfConfig) {
  const [cR, cG, cB] = hexToRgb(cfg.corDestaque || "#38BDF8");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  let y = 15;
  if (cfg.logoDataUrl) {
    try { doc.addImage(cfg.logoDataUrl, "PNG", 15, y, 14, 14); } catch {}
  }
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(oficina.nome || "OrçaAr Condicionado", cfg.logoDataUrl ? 33 : 15, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text([oficina.telefone, oficina.email].filter(Boolean).join("  ·  "), cfg.logoDataUrl ? 33 : 15, y + 12);
  y += 22;

  const numero = "OS" + o.id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const dataStr = new Date(o.createdAt).toLocaleDateString("pt-BR");
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Orçamento", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const meta = [dataStr, cfg.mostrarNumeroOS ? numero : null].filter(Boolean).join("  ·  ");
  doc.text(meta, W - 15, y, { align: "right" });
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`${o.cliente.nome || "—"}  ·  ${o.cliente.telefone || "—"}`, 15, y);
  y += 5;
  if (cfg.mostrarVeiculo) {
    doc.text(
      `${o.veiculo.marcaModelo || "—"} ${o.veiculo.ano || ""}  ·  ${o.veiculo.placa || "—"}`,
      15, y,
    );
    y += 5;
  }
  y += 3;

  const ensure = (n: number) => { if (y + n > H - 18) { doc.addPage(); y = 15; } };

  const sectionTitle = (t: string) => {
    ensure(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(cR, cG, cB);
    doc.text(t.toUpperCase(), 15, y);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, y, W - 15, y);
    y += 4;
  };

  const row = (left: string, right: string) => {
    ensure(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(left, W - 60);
    doc.text(lines, 15, y);
    doc.setFont("helvetica", "bold");
    doc.text(right, W - 15, y, { align: "right" });
    y += Math.max(5, lines.length * 4);
    doc.setDrawColor(240, 240, 240);
    doc.line(15, y, W - 15, y);
    y += 2;
  };

  if (o.parts.length) {
    sectionTitle("Peças");
    for (const p of o.parts) {
      row(`${p.name}  ×${p.qty} ${p.unit}`, brl(p.price * p.qty));
    }
    y += 3;
  }
  const servicos = o.servicosDetalhados?.length
    ? o.servicosDetalhados
    : o.totals.maoObra > 0
      ? [{ nome: o.servicoNome || "Mão de obra", descricao: "", valor: o.totals.maoObra }]
      : [];
  if (servicos.length) {
    sectionTitle("Serviços");
    for (const s of servicos) row(s.nome + (s.descricao ? ` — ${s.descricao}` : ""), brl(s.valor));
    y += 3;
  }

  // total minimalista
  ensure(15);
  doc.setDrawColor(cR, cG, cB);
  doc.setLineWidth(0.8);
  doc.line(15, y, W - 15, y);
  y += 6;
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL", 15, y);
  doc.setTextColor(cR, cG, cB);
  doc.text(brl(o.totals.total), W - 15, y, { align: "right" });
  y += 10;

  if (cfg.mostrarObservacoes && o.observacoes?.trim()) {
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(o.observacoes.trim(), W - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4;
  }

  // rodape
  if (cfg.rodapeTexto?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const lines = doc.splitTextToSize(cfg.rodapeTexto.trim(), W - 30);
    doc.text(lines, 15, H - 10);
  }

  const placa = (o.cliente.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  doc.save(`orcamento-${placa}-${fileDate(new Date(o.createdAt))}-${numero}.pdf`);
}
