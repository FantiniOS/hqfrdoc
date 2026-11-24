import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { ensureMonthlyInvoicesForCompetence } from "@/lib/billing-automation";
import { getShortCompetenceLabel, isValidCompetence } from "@/lib/format";

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

    const result = await ensureMonthlyInvoicesForCompetence(parsed.data.competence);
    const compLabel = getShortCompetenceLabel(result.competence);

    return NextResponse.json({
      ...result,
      message:
        result.totalActiveClinics === 0
          ? "Nenhuma clínica ativa encontrada para faturar."
          : result.createdCount > 0
            ? `${result.createdCount} mensalidade(s) gerada(s) em ${compLabel}.`
            : `Todas as ${result.totalActiveClinics} clínicas ativas já estão faturadas em ${compLabel}.`,
    });
  } catch (err) {
    console.error("[api/invoices/generate-monthly] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao sincronizar mensalidades." },
      { status: 500 }
    );
  }
}
