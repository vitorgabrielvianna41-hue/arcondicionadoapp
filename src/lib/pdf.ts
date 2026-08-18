import { jsPDF } from "jspdf";
import type { Orcamento, Settings } from "./storage";
import { brl } from "./parts";

function drawLogo(doc: jsPDF, x: number, y: number, size = 10) {
  // Engrenagem amarela simplificada
  doc.setFillColor(255, 214, 10);
  doc.circle(x + size / 2, y + size / 2, size / 2, "F");
  doc.setFillColor(10, 14, 26);
  doc.circle(x + size / 2, y + size / 2, size / 5, "F");
}

export async function gerarPDF(o: Orcamento, s: Settings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, W, 30, "F");
  drawLogo(doc, 12, 8, 14);
  doc.setTextColor(255, 214, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ORÇA AR CONDICIONADO", 30, 15);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(s.company.nome || "Orçamento profissional", 30, 25);
  doc.setFontSize(8);
  doc.text(
    [s.company.telefone, s.company.cidadeEstado, s.company.documento]
      .filter(Boolean)
      .join(" • "),
    W - 12,
    25,
    { align: "right" }
  );

  y = 40;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);

  const meta = [
    ["Cliente:", `${o.cliente.nome}${o.cliente.telefone ? " • " + o.cliente.telefone : ""}`],
    ["Equipamento:", `${o.veiculo.marcaModelo} ${o.veiculo.ano}`.trim()],
    ["Local:", o.veiculo.placa || "—"],
    ["Serviço:", o.servicoNome],
    ["Data:", new Date(o.createdAt).toLocaleDateString("pt-BR")],
  ];
  meta.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 12, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, 32, y);
    y += 6;
  });

  // Foto opcional
  if (o.fotoDataUrl) {
    try {
      const imgW = 55;
      const imgH = 40;
      doc.addImage(o.fotoDataUrl, "JPEG", W - imgW - 12, 40, imgW, imgH);
      y = Math.max(y, 40 + imgH + 4);
    } catch {
      // ignora
    }
  }

  y += 4;
  // Tabela peças
  doc.setFillColor(10, 14, 26);
  doc.rect(10, y - 5, W - 20, 8, "F");
  doc.setTextColor(255, 214, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ITEM", 12, y);
  doc.text("QTD", 110, y);
  doc.text("UNIT.", 135, y);
  doc.text("SUBTOTAL", 165, y);
  y += 6;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  o.parts.forEach((p) => {
    doc.text(p.name.substring(0, 55), 12, y);
    doc.text(`${p.qty} ${p.unit}`, 110, y);
    doc.text(brl(p.price), 135, y);
    doc.text(brl(p.price * p.qty), 165, y);
    y += 6;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  y += 4;
  doc.setDrawColor(180);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(10, y, W - 10, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text(`Total de peças: ${brl(o.totals.pecas)}`, 110, y);
  y += 6;
  doc.text(`Mão de obra: ${brl(o.totals.maoObra)}`, 110, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(10, 14, 26);
  doc.text(`TOTAL: ${brl(o.totals.total)}`, 110, y);

  // Parcelamento
  if (o.parcelas && o.parcelas >= 2) {
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(60, 60, 60);
    const valorParc = o.totals.total / o.parcelas;
    doc.text(`ou em até ${o.parcelas}x de ${brl(valorParc)} sem juros`, 110, y);
  }

  // Observações
  if (o.observacoes && o.observacoes.trim()) {
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(10, 14, 26);
    doc.text("Observações:", 12, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(o.observacoes, W - 24);
    doc.text(lines, 12, y);
    y += lines.length * 5;
  }

  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Orçamento válido por ${s.validadeDias} dias a partir da data de emissão.`,
    12,
    y
  );

  doc.save(`orcamento-${o.cliente.nome.replace(/\s+/g, "_")}-${o.id.slice(0, 6)}.pdf`);
}

export function gerarTexto(o: Orcamento, s: Settings) {
  const linhas = [
    `*🔧 ORÇAMENTO - ${s.company.nome || "OrçaAr Condicionado Pro"}*`,
    ``,
    `*Cliente:* ${o.cliente.nome}`,
    `*Equipamento:* ${o.veiculo.marcaModelo} ${o.veiculo.ano}`.trim(),
    `*Serviço:* ${o.servicoNome}`,
    `*Data:* ${new Date(o.createdAt).toLocaleDateString("pt-BR")}`,
    ``,
    `*Peças e Materiais:*`,
    ...o.parts.map(
      (p) => `• ${p.name} - ${p.qty} ${p.unit} x ${brl(p.price)} = ${brl(p.price * p.qty)}`
    ),
    ``,
    `Peças: ${brl(o.totals.pecas)}`,
    `Mão de obra: ${brl(o.totals.maoObra)}`,
    `*TOTAL: ${brl(o.totals.total)}*`,
  ];
  if (o.parcelas && o.parcelas >= 2) {
    linhas.push(`_ou em até ${o.parcelas}x de ${brl(o.totals.total / o.parcelas)} sem juros_`);
  }
  if (o.observacoes && o.observacoes.trim()) {
    linhas.push(``, `*Observações:* ${o.observacoes}`);
  }
  linhas.push(``, `_Válido por ${s.validadeDias} dias._`);
  return linhas.join("\n");
}
