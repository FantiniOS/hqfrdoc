import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { parseDateInputToUTC } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const patchInvoiceSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settle"),
    paidAt: z.string().min(8, "Informe a data do pagamento."),
    paymentMethod: z.enum(["PIX", "BOLETO", "CARD", "TRANSFER"]),
    receiptNote: z.string().trim().optional().nullable(),
  }),
  z.object({
    action: z.literal("reopen"),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
  z.object({
    action: z.literal("update"),
    description: z.string().trim().min(2).optional(),
    amountCents: z.coerce.number().int().min(1).optional(),
    dueDate: z.string().min(8).optional(),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = patchInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Operação inválida na fatura." },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    let updated;

    if (payload.action === "settle") {
      updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: parseDateInputToUTC(payload.paidAt),
          paymentMethod: payload.paymentMethod,
          receiptNote: payload.receiptNote?.trim() || null,
        },
      });
    } else if (payload.action === "reopen") {
      updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: "OPEN",
          paidAt: null,
          paymentMethod: null,
          receiptNote: null,
        },
      });
    } else if (payload.action === "cancel") {
      updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: "CANCELED",
          paidAt: null,
          paymentMethod: null,
        },
      });
    } else {
      const updateData: Prisma.InvoiceUpdateInput = {};
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.amountCents !== undefined) updateData.amountCents = payload.amountCents;
      if (payload.dueDate !== undefined) {
        updateData.dueDate = parseDateInputToUTC(payload.dueDate);
      }

      updated = await prisma.invoice.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({ invoice: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
    }
    console.error("[api/invoices/[id] PATCH] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar fatura." },
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
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
    }
    console.error("[api/invoices/[id] DELETE] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao excluir fatura." },
      { status: 500 }
    );
  }
}
