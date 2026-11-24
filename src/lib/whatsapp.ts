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
  const firstName = params.responsibleName.trim().split(/\s+/)[0] || params.responsibleName;

  const pixLines: string[] = [];
  if (params.pixKey && params.pixKey.trim()) {
    const keyType = params.pixKeyType?.trim() ? ` (${params.pixKeyType.trim()})` : "";
    pixLines.push(`*Chave PIX${keyType}:* ${params.pixKey.trim()}`);
    if (params.pixHolderName?.trim()) {
      pixLines.push(`*Titular:* ${params.pixHolderName.trim()}`);
    }
  }

  const pixBlock =
    pixLines.length > 0
      ? `\n\nDados para pagamento via PIX:\n${pixLines.join("\n")}`
      : "";

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    const daysLabel = overdueDays === 1 ? "1 dia" : `${overdueDays} dias`;
    return (
      `Olá, ${firstName}! Tudo bem?\n\n` +
      `Passando para lembrar sobre a fatura em aberto da *${params.clinicName}* referente à *${params.description}* (${brand}):\n\n` +
      `• *Valor:* ${amountText}\n` +
      `• *Vencimento original:* ${dueText} (em atraso há ${daysLabel})` +
      pixBlock +
      `\n\nCaso o pagamento já tenha sido efetuado, por gentileza desconsidere esta mensagem e nos envie o comprovante por aqui. Qualquer dúvida, fico à disposição!`
    );
  }

  if (daysDiff === 0) {
    return (
      `Olá, ${firstName}! Tudo bem?\n\n` +
      `Lembrete amigável: vence *hoje (${dueText})* a fatura da *${params.clinicName}* referente à *${params.description}* (${brand}).\n\n` +
      `• *Valor:* ${amountText}\n` +
      `• *Vencimento:* ${dueText}` +
      pixBlock +
      `\n\nAssim que realizar o pagamento, se puder nos encaminhar o comprovante por aqui, agradeço. Qualquer dúvida estou à disposição!`
    );
  }

  return (
    `Olá, ${firstName}! Tudo bem?\n\n` +
    `Segue o lembrete da próxima fatura da *${params.clinicName}* referente à *${params.description}* (${brand}):\n\n` +
    `• *Valor:* ${amountText}\n` +
    `• *Vencimento:* ${dueText}` +
    pixBlock +
    `\n\nSe precisar de qualquer apoio, conte comigo. Um ótimo dia!`
  );
}

export function buildWhatsAppChargeUrl(params: WhatsAppChargeParams): string | null {
  const phone = sanitizeBrazilianPhone(params.whatsapp);
  if (!phone) return null;
  const text = buildWhatsAppChargeMessage(params);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
