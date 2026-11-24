import { formatBRL, formatDateBR, getDaysDiffFromToday } from "@/lib/format";

export function sanitizeBrazilianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  return `55${digits}`;
}

export interface WhatsAppChargeParams {
  whatsapp: string;
  responsibleName: string;
  clinicName: string;
  description: string;
  amountCents: number;
  dueDate: Date | string;
  invoiceUrl?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixHolderName?: string | null;
  companyName?: string | null;
}

export function buildWhatsAppChargeMessage(params: WhatsAppChargeParams): string {
  const daysDiff = getDaysDiffFromToday(params.dueDate);
  const amountText = formatBRL(params.amountCents);
  const dueText = formatDateBR(params.dueDate);
  const brand = params.companyName?.trim() || "FRdoc";
  const firstName =
    params.responsibleName.trim().split(/\s+/)[0] || params.responsibleName;

  const linkLine = params.invoiceUrl?.trim()
    ? `\n\nLink da fatura com QR Code PIX:\n${params.invoiceUrl.trim()}`
    : params.pixKey?.trim()
      ? `\n\nPIX (${params.pixKeyType || "Chave"}): ${params.pixKey.trim()}`
      : "";

  if (daysDiff < 0) {
    return (
      `Olá, ${firstName}. Tudo bem?\n\n` +
      `Identificamos em aberto a fatura da *${params.clinicName}* referente a *${params.description}* (${brand}), no valor de *${amountText}* (vencimento ${dueText}).` +
      linkLine +
      `\n\nCaso já tenha efetuado o pagamento, por gentileza desconsidere.`
    );
  }

  return (
    `Olá, ${firstName}. Tudo bem?\n\n` +
    `Segue a fatura da *${params.clinicName}* referente a *${params.description}* (${brand}), no valor de *${amountText}* com vencimento em *${dueText}*.` +
    linkLine +
    `\n\nQualquer dúvida, estamos à disposição.`
  );
}

export function buildWhatsAppChargeUrl(params: WhatsAppChargeParams): string | null {
  const phone = sanitizeBrazilianPhone(params.whatsapp);
  if (!phone) return null;
  const text = buildWhatsAppChargeMessage(params);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
