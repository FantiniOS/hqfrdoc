import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const contractStatusSchema = z.object({
  contractStatus: z.enum(["DRAFT", "SENT", "SIGNED"], {
    message: "Status de contrato inválido (use DRAFT, SENT ou SIGNED).",
  }),
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
    const parsed = contractStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Status inválido." },
        { status: 400 }
      );
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        contractStatus: parsed.data.contractStatus,
      },
      select: {
        id: true,
        contractStatus: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { clinic },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    }
    console.error("[api/clinics/[id]/contract PATCH] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar status do contrato." },
      { status: 500 }
    );
  }
}
