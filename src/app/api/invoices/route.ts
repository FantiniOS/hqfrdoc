import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import {
  ensureMonthlyInvoicesForCompetence,
  generateCryptoHexToken,
} from "@/lib/billing-automation";
import {
  buildDueDateForCompetence,
  getTodaySaoPaulo,
  isValidCompetence,
  parseDateInputToUTC,
  shiftCompetence,
} from "@/lib/format";
import { getOrCreateSettings } from "@/lib/hq-data";
import { computeInvoiceDisplayStatus, INVOICE_TYPE_LABELS } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createInvoiceSchema = z.object({
  clinicId: z.string().min(1, "Selecione a clínica."),
  type: z.enum([
    "MONTHLY",
    "SETUP",
    "MIGRATION",
    "EXTRA_TRAINING",
    "PDF_CUSTOMIZATION",
    "OTHER_SERVICE",
  ]),
  description: z.string().trim().optional(),
  amountCents: z.coerce.number().int().min(1, "Informe um valor maior que zero."),
  dueDate: z.string().min(8, "Informe a data de vencimento."),
  installments: z.coerce.number().int().min(1).max(3).default(1),
});

export async function GET(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const today = getTodaySaoPaulo();
    const rawCompetence = searchParams.get("competence") ?? today.competence;
    const competence = isValidCompetence(rawCompetence)
      ? rawCompetence
      : today.competence;
    const statusFilter = searchParams.get("status")?.trim() ?? "ALL";

    // Automação de recorrência: garante mensalidades da competência corrente
    if (competence === today.competence) {
      await ensureMonthlyInvoicesForCompetence(today.competence);
    }

    const [rawInvoices, clinics, settings] = await Promise.all([
      prisma.invoice.findMany({
        where: { competence },
        include: {
          clinic: {
            select: {
              id: true,
              name: true,
              responsibleName: true,
              whatsapp: true,
              status: true,
              subdomain: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      }),
      prisma.clinic.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          setupFeeCents: true,
          monthlyFeeCents: true,
          dueDay: true,
        },
        orderBy: { name: "asc" },
      }),
      getOrCreateSettings(),
    ]);

    const enriched = rawInvoices.map((inv) => {
      const computed = computeInvoiceDisplayStatus(inv.status, inv.dueDate);
      return {
        ...inv,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        displayStatus: computed.displayStatus,
        daysDiff: computed.daysDiff,
        statusLabel: computed.label,
      };
    });

    const filtered =
      statusFilter && statusFilter !== "ALL"
        ? enriched.filter((inv) => inv.displayStatus === statusFilter)
        : enriched;

    const summary = {
      totalCents: enriched
        .filter((i) => i.status !== "CANCELED")
        .reduce((s, i) => s + i.amountCents, 0),
      paidCents: enriched
        .filter((i) => i.displayStatus === "PAID")
        .reduce((s, i) => s + i.amountCents, 0),
      openCents: enriched
        .filter((i) => i.status === "OPEN")
        .reduce((s, i) => s + i.amountCents, 0),
      overdueCents: enriched
        .filter((i) => i.displayStatus === "OVERDUE")
        .reduce((s, i) => s + i.amountCents, 0),
      counts: {
        all: enriched.length,
        paid: enriched.filter((i) => i.displayStatus === "PAID").length,
        open: enriched.filter((i) => i.displayStatus === "OPEN").length,
        dueSoon: enriched.filter((i) => i.displayStatus === "DUE_SOON").length,
        overdue: enriched.filter((i) => i.displayStatus === "OVERDUE").length,
      },
    };

    return NextResponse.json(
      {
        competence,
        invoices: filtered,
        summary,
        clinics,
        settings: {
          pixKey: settings.pixKey,
          pixKeyType: settings.pixKeyType,
          pixHolderName: settings.pixHolderName,
          companyName: settings.companyName,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/invoices GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar faturas da competência." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = createInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados do lançamento inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const clinic = await prisma.clinic.findUnique({ where: { id: data.clinicId } });
    if (!clinic) {
      return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    }

    const installments = data.type === "SETUP" ? data.installments : 1;
    const firstDueDate = parseDateInputToUTC(data.dueDate);
    const baseYear = firstDueDate.getUTCFullYear();
    const baseMonth = String(firstDueDate.getUTCMonth() + 1).padStart(2, "0");
    const baseDay = firstDueDate.getUTCDate();
    const baseCompetence = `${baseYear}-${baseMonth}`;

    const baseTitle =
      data.description && data.description.trim().length > 0
        ? data.description.trim()
        : INVOICE_TYPE_LABELS[data.type];

    const baseAmount = Math.floor(data.amountCents / installments);
    const remainder = data.amountCents - baseAmount * installments;

    const invoicesToCreate = Array.from({ length: installments }, (_, idx) => {
      const comp = idx === 0 ? baseCompetence : shiftCompetence(baseCompetence, idx);
      const dueDate =
        idx === 0
          ? firstDueDate
          : buildDueDateForCompetence(comp, Math.min(baseDay, 28));
      const installmentNumber = installments > 1 ? idx + 1 : null;
      const installmentTotal = installments > 1 ? installments : null;
      const description =
        installments > 1 ? `${baseTitle} (${idx + 1}/${installments})` : baseTitle;
      const amountCents = idx === 0 ? baseAmount + remainder : baseAmount;

      return {
        publicToken: generateCryptoHexToken(24),
        clinicId: data.clinicId,
        type: data.type,
        competence: comp,
        description,
        amountCents,
        dueDate,
        status: "OPEN" as const,
        installmentNumber,
        installmentTotal,
      };
    });

    const created = await prisma.$transaction(
      invoicesToCreate.map((item) => prisma.invoice.create({ data: item }))
    );

    return NextResponse.json(
      {
        invoices: created,
        createdCount: created.length,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Já existe um lançamento deste mesmo tipo para esta clínica em uma das competências selecionadas.",
        },
        { status: 409 }
      );
    }
    console.error("[api/invoices POST] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao criar lançamento avulso." },
      { status: 500 }
    );
  }
}
