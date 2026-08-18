// Gerador de payload Pix "Copia e Cola" (BR Code EMV)
// Spec: BACEN — formato TLV (ID + tamanho + valor) com CRC16-CCITT (poly 0x1021, init 0xFFFF).

function tlv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const sanitize = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .toUpperCase()
    .slice(0, max);

export function buildPix(opts: {
  chave: string;
  nome: string;
  cidade: string;
  valor: number;
  txid?: string;
  descricao?: string;
}): string {
  const merchant = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", opts.chave);
  const txid = sanitize(opts.txid || "***", 25) || "***";

  const payload =
    tlv("00", "01") +
    tlv("26", merchant) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", opts.valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(opts.nome || "RECEBEDOR", 25)) +
    tlv("60", sanitize(opts.cidade || "BRASIL", 15)) +
    tlv("62", tlv("05", txid));

  const base = payload + "6304";
  return base + crc16(base);
}
