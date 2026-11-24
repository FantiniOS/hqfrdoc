import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fixedCostSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do custo."),
  category: z.string().trim().min(1).default("Infraestrutura"),
  monthlyAmountCents: z.coerce.number().int().min(0, "Informe um valor válido."),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  active: z.boolean().default(true),
  notes: z.string().trim().optional().nullable(),
});

export async function GET() {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const fixedCosts = await prisma.fixedCost.findMany({
      orderBy: [{ active: "desc" }, { monthlyAmountCents: "desc" }],
    });

    const totalActiveMonthlyCents = fixedCosts
      .filter((c) => c.active)
      .reduce((sum, c) => sum + c.monthlyAmountCents, 0);

    return NextResponse.json(
      { fixedCosts, totalActiveMonthlyCents },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/fixed-costs GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao listar custos fixos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = fixedCostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados do custo fixo inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const fixedCost = await prisma.fixedCost.create({
      data: {
        name: data.name,
        category: data.category,
        monthlyAmountCents: data.monthlyAmountCents,
        billingCycle: data.billingCycle,
        active: data.active,
        notes: data.notes?.trim() || null,
      },
    });

    return NextResponse.json({ fixedCost }, { status: 201 });
  } catch (err) {
    console.error("[api/fixed-costs POST] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao cadastrar custo fixo." },
      { status: 500 }
    );
  }
}
