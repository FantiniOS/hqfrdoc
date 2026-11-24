import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const updateFixedCostSchema = z.object({
  name: z.string().trim().min(2).optional(),
  category: z.string().trim().min(1).optional(),
  monthlyAmountCents: z.coerce.number().int().min(0).optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  active: z.boolean().optional(),
  notes: z.string().trim().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateFixedCostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const fixedCost = await prisma.fixedCost.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.monthlyAmountCents !== undefined
          ? { monthlyAmountCents: data.monthlyAmountCents }
          : {}),
        ...(data.billingCycle !== undefined ? { billingCycle: data.billingCycle } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      },
    });

    return NextResponse.json({ fixedCost });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Custo fixo não encontrado." }, { status: 404 });
    }
    console.error("[api/fixed-costs/[id] PATCH] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar custo fixo." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    await prisma.fixedCost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Custo fixo não encontrado." }, { status: 404 });
    }
    console.error("[api/fixed-costs/[id] DELETE] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao remover custo fixo." },
      { status: 500 }
    );
  }
}
