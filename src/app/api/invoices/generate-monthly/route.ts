import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import {
  buildDueDateForCompetence,
  getShortCompetenceLabel,
  isValidCompetence,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

const generateSchema = z.object({
  competence: z
    .string()
    .refine(isValidCompetence, "Competência inválida (use o formato YYYY-MM)."),
});

export async function POST(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Competência inválida." },
        { status: 400 }
      );
    }

    const { competence } = parsed.data;
    const activeClinics = await prisma.clinic.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        monthlyFeeCents: true,
        dueDay: true,
      },
    });

    if (activeClinics.length === 0) {
      return NextResponse.json({
        competence,
        totalActiveClinics: 0,
        createdCount: 0,
        skippedCount: 0,
        message: "Nenhuma clínica com status Ativa encontrada para faturar.",
      });
    }

    const compLabel = getShortCompetenceLabel(competence);

    // Idempotente via chave única @@unique([clinicId, competence, type])
    const result = await prisma.invoice.createMany({
      data: activeClinics.map((clinic) => ({
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

    const createdCount = result.count;
    const skippedCount = activeClinics.length - createdCount;

    return NextResponse.json({
      competence,
      totalActiveClinics: activeClinics.length,
      createdCount,
      skippedCount,
      message:
        createdCount > 0
          ? `${createdCount} mensalidade(s) gerada(s) com sucesso${
              skippedCount > 0 ? ` (${skippedCount} já existente(s) preservada(s))` : ""
            }.`
          : `Todas as ${activeClinics.length} clínicas ativas já possuem mensalidade lançada em ${compLabel}.`,
    });
  } catch (err) {
    console.error("[api/invoices/generate-monthly] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao gerar mensalidades do mês." },
      { status: 500 }
    );
  }
}
