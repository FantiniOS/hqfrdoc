import QRCode from "qrcode";

function stripAccentsAndClean(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 /.-]/g, "")
    .trim();
}

function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * Normaliza a chave PIX conforme regras do DICT / Banco Central:
 * - CPF / CNPJ: somente dígitos
 * - Telefone: formato internacional +55DDDNUMERO
 * - E-mail: minúsculas sem espaços
 * - Chave Aleatória (EVP): UUID limpo
 */
export function normalizePixKeyForEmv(rawKey: string, keyType?: string | null): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return "";

  const normalizedType = (keyType ?? "").toUpperCase();

  if (normalizedType === "CNPJ" || normalizedType === "CPF") {
    return trimmed.replace(/\D/g, "");
  }

  if (normalizedType === "TELEFONE") {
    const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
    if (!digits) return "";
    return digits.startsWith("55") && digits.length >= 12
      ? `+${digits}`
      : `+55${digits}`;
  }

  if (normalizedType.includes("MAIL") || trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  // Caso não tenha tipo explícito mas pareça CPF/CNPJ formatado
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(trimmed) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\D/g, "");
  }

  return trimmed;
}

/**
 * CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) exigido na tag 63 do BR Code.
 */
export function computeCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadInput {
  pixKey: string;
  pixKeyType?: string | null;
  merchantName?: string | null;
  merchantCity?: string | null;
  amountCents?: number | null;
  txid?: string | null;
}

/**
 * Gera o código PIX "Copia e Cola" padrão BR Code / EMV QRCPS-MPM do Banco Central.
 */
export function buildPixBrCode(input: PixPayloadInput): string | null {
  const key = normalizePixKeyForEmv(input.pixKey, input.pixKeyType);
  if (!key) return null;

  const merchantNameClean =
    stripAccentsAndClean(input.merchantName || "FRDOC")
      .toUpperCase()
      .slice(0, 25) || "FRDOC";

  const rawCity = (input.merchantCity || "CONTAGEM").split("/")[0]?.split("-")[0] ?? "CONTAGEM";
  const merchantCityClean =
    stripAccentsAndClean(rawCity).toUpperCase().slice(0, 15) || "CONTAGEM";

  const rawTxid = (input.txid || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 25);
  const txid = rawTxid || "***";

  // Tag 26: Merchant Account Information (GUI + Chave PIX)
  const guiField = emvField("00", "br.gov.bcb.pix");
  const keyField = emvField("01", key);
  const merchantAccountInfo = emvField("26", `${guiField}${keyField}`);

  const parts: string[] = [
    emvField("00", "01"), // Payload Format Indicator
    merchantAccountInfo,
    emvField("52", "0000"), // Merchant Category Code
    emvField("53", "986"), // Moeda BRL (ISO 4217)
  ];

  if (input.amountCents && input.amountCents > 0) {
    const amountStr = (input.amountCents / 100).toFixed(2);
    parts.push(emvField("54", amountStr));
  }

  parts.push(
    emvField("58", "BR"),
    emvField("59", merchantNameClean),
    emvField("60", merchantCityClean),
    emvField("62", emvField("05", txid))
  );

  const withoutCrc = `${parts.join("")}6304`;
  const crc = computeCrc16Ccitt(withoutCrc);
  return `${withoutCrc}${crc}`;
}

export async function generatePixQrSvg(brCode: string): Promise<string> {
  return QRCode.toString(brCode, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

export async function generatePixQrDataUrl(brCode: string): Promise<string> {
  return QRCode.toDataURL(brCode, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}
