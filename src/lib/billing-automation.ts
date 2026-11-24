import crypto from "node:crypto";
import {
  buildDueDateForCompetence,
  getShortCompetenceLabel,
  getTodaySaoPaulo,
  isValidCompetence,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export function generateCryptoHexToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex"); // 48 chars hex
}

/**
 * Gera de forma idempotente as mensalidades de todas as clínicas ATIVAS
 * para a competência informada (por padrão, o mês corrente em São Paulo).
 * Respeita @@unique([clinicId, competence, type]) sem duplicar cobranças.
 */
export async function ensureMonthlyInvoicesForCompetence(competenceInput?: string): Promise<{
  competence: string;
  totalActiveClinics: number;
  createdCount: number;
  skippedCount: number;
}> {
  const today = getTodaySaoPaulo();
  const competence =
    competenceInput && isValidCompetence(competenceInput)
      ? competenceInput
      : today.competence;

  const activeClinics = await prisma.clinic.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      monthlyFeeCents: true,
      dueDay: true,
    },
  });

  if (activeClinics.length === 0) {
    return {
      competence,
      totalActiveClinics: 0,
      createdCount: 0,
      skippedCount: 0,
    };
  }

  const compLabel = getShortCompetenceLabel(competence);

  const result = await prisma.invoice.createMany({
    data: activeClinics.map((clinic) => ({
      publicToken: generateCryptoHexToken(24),
      clinicId: clinic.id,
      type: "MONTHLY" as const,
      competence,
      description: `Mensalidade — ${compLabel}`,
      amountCents: clinic.monthlyFeeCents,
      dueDate: buildDueDateForCompetence(competence, clinic.dueDay),
      status: "OPEN" as const,
    })),
    skipDuplicates: true,
  });

  return {
    competence,
    totalActiveClinics: activeClinics.length,
    createdCount: result.count,
    skippedCount: activeClinics.length - result.count,
  };
}
