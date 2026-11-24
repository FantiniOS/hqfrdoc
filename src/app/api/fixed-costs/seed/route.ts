import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const SUGGESTED_FIXED_COSTS = [
  {
    name: "Vercel Pro",
    category: "Hospedagem",
    monthlyAmountCents: 12_000, // R$ 120,00/mês
    billingCycle: "MONTHLY" as const,
    active: true,
    notes: "Plano Pro de hospedagem e deployments das aplicações FRdoc",
  },
  {
    name: "Apple Developer",
    category: "Licenças",
    monthlyAmountCents: 4_950, // R$ 49,50/mês equivalente anual
    billingCycle: "ANNUAL" as const,
    active: true,
    notes: "Equivalente mensal da licença anual da Apple Developer",
  },
  {
    name: "Domínio frdoc.com.br",
    category: "Domínios",
    monthlyAmountCents: 333, // R$ 3,33/mês equivalente anual
    billingCycle: "ANNUAL" as const,
    active: true,
    notes: "Equivalente mensal da renovação anual no Registro.br (R$ 40,00/ano)",
  },
];

export async function POST() {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const existing = await prisma.fixedCost.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase().trim()));

    const missing = SUGGESTED_FIXED_COSTS.filter(
      (item) => !existingNames.has(item.name.toLowerCase().trim())
    );

    if (missing.length > 0) {
      await prisma.fixedCost.createMany({ data: missing });
    }

    return NextResponse.json({
      createdCount: missing.length,
      message:
        missing.length > 0
          ? `${missing.length} custo(s) padrão da FRdoc adicionado(s).`
          : "Os custos padrão da FRdoc já estão cadastrados.",
    });
  } catch (err) {
    console.error("[api/fixed-costs/seed] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar custos padrão da plataforma." },
      { status: 500 }
    );
  }
}
