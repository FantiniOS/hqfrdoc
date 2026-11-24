import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { normalizeSubdomain, parseDateInputToUTC } from "@/lib/format";
import { calculateOfficialPricing } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

const optionalPositiveInt = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
  z.number().int().min(1).max(60).nullable()
);

const clinicUpdateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da clínica."),
  legalName: z.string().trim().max(200).optional().nullable(),
  cnpj: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  responsibleName: z.string().trim().min(2, "Informe o médico ou responsável."),
  legalRepName: z.string().trim().max(160).optional().nullable(),
  legalRepCpf: z.string().trim().max(24).optional().nullable(),
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp de contato."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .or(z.literal(""))
    .optional()
    .nullable(),
  subdomain: z.string().trim().optional().nullable(),
  status: z.enum(["ACTIVE", "ONBOARDING", "DELINQUENT", "PAUSED", "CANCELED"]),
  activeDoctors: z.coerce.number().int().min(1).max(500),
  planTier: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  isFounder: z.boolean().default(false),
  setupFeeCents: z.coerce.number().int().min(0),
  setupInstallments: optionalPositiveInt.optional(),
  monthlyFeeCents: z.coerce.number().int().min(0),
  dueDay: z.coerce.number().int().min(1).max(28),
  startDate: z.string().min(8),
  nextAdjustmentDate: z.string().optional().nullable(),
  contractStartDate: z.string().optional().nullable(),
  fidelityMonths: optionalPositiveInt.optional(),
  contractStatus: z.enum(["DRAFT", "SENT", "SIGNED"]).default("DRAFT"),
  infraType: z.enum(["ORACLE_ALWAYS_FREE", "ORACLE_DEDICATED_VM", "PAID_DEDICATED_DB"]),
  infraCostCents: z.coerce.number().int().min(0),
  technicalNotes: z.string().trim().optional().nullable(),
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
    const parsed = clinicUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados da clínica inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const official = calculateOfficialPricing(data.activeDoctors);

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        name: data.name,
        legalName: data.legalName?.trim() || null,
        cnpj: data.cnpj?.trim() || null,
        address: data.address?.trim() || null,
        responsibleName: data.responsibleName,
        legalRepName: data.legalRepName?.trim() || null,
        legalRepCpf: data.legalRepCpf?.trim() || null,
        whatsapp: data.whatsapp,
        email: data.email?.trim() || null,
        subdomain: normalizeSubdomain(data.subdomain),
        status: data.status,
        activeDoctors: data.activeDoctors,
        planTier: data.planTier ?? official.tier,
        isFounder: data.isFounder,
        setupFee: Number((data.setupFeeCents / 100).toFixed(2)),
        setupFeeCents: data.setupFeeCents,
        setupInstallments: data.setupInstallments ?? null,
        monthlyFeeCents: data.monthlyFeeCents,
        dueDay: data.dueDay,
        startDate: parseDateInputToUTC(data.startDate),
        nextAdjustmentDate: data.nextAdjustmentDate?.trim()
          ? parseDateInputToUTC(data.nextAdjustmentDate)
          : null,
        contractStartDate: data.contractStartDate?.trim()
          ? parseDateInputToUTC(data.contractStartDate)
          : null,
        fidelityMonths: data.fidelityMonths ?? null,
        contractStatus: data.contractStatus,
        infraType: data.infraType,
        infraCostCents: data.infraCostCents,
        technicalNotes: data.technicalNotes?.trim() || null,
      },
    });

    return NextResponse.json({ clinic });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "Este subdomínio já está vinculado a outra clínica." },
          { status: 409 }
        );
      }
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "Clínica não encontrada." },
          { status: 404 }
        );
      }
    }
    console.error("[api/clinics/[id] PATCH] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar clínica." },
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
    await prisma.clinic.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    }
    console.error("[api/clinics/[id] DELETE] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao remover clínica." },
      { status: 500 }
    );
  }
}
