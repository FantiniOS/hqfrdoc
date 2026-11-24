import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import {
  addOneYearUTC,
  normalizeSubdomain,
  parseDateInputToUTC,
} from "@/lib/format";
import { getOrCreateSettings } from "@/lib/hq-data";
import { calculateOfficialPricing } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const optionalPositiveInt = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
  z.number().int().min(1).max(60).nullable()
);

const clinicPayloadSchema = z.object({
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
  status: z
    .enum(["ACTIVE", "ONBOARDING", "DELINQUENT", "PAUSED", "CANCELED"])
    .default("ONBOARDING"),
  activeDoctors: z.coerce.number().int().min(1, "Informe pelo menos 1 médico ativo.").max(500),
  planTier: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  isFounder: z.boolean().default(false),
  setupFeeCents: z.coerce.number().int().min(0),
  setupInstallments: optionalPositiveInt.optional(),
  monthlyFeeCents: z.coerce.number().int().min(0),
  dueDay: z.coerce.number().int().min(1, "Dia entre 1 e 28.").max(28, "Dia entre 1 e 28."),
  startDate: z.string().min(8, "Informe a data de início."),
  nextAdjustmentDate: z.string().optional().nullable(),
  contractStartDate: z.string().optional().nullable(),
  fidelityMonths: optionalPositiveInt.optional(),
  contractStatus: z.enum(["DRAFT", "SENT", "SIGNED"]).default("DRAFT"),
  infraType: z
    .enum(["ORACLE_ALWAYS_FREE", "ORACLE_DEDICATED_VM", "PAID_DEDICATED_DB"])
    .default("ORACLE_ALWAYS_FREE"),
  infraCostCents: z.coerce.number().int().min(0).default(0),
  technicalNotes: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";

    const where: Prisma.ClinicWhereInput = {};

    if (
      status &&
      ["ACTIVE", "ONBOARDING", "DELINQUENT", "PAUSED", "CANCELED"].includes(status)
    ) {
      where.status = status as Prisma.ClinicWhereInput["status"];
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { legalName: { contains: search, mode: "insensitive" } },
        { responsibleName: { contains: search, mode: "insensitive" } },
        { subdomain: { contains: search, mode: "insensitive" } },
        { cnpj: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [clinics, settings] = await Promise.all([
      prisma.clinic.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      }),
      getOrCreateSettings(),
    ]);

    return NextResponse.json(
      {
        clinics,
        defaultFidelityMonths: settings.defaultFidelityMonths,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/clinics GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao listar clínicas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = clinicPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados da clínica inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const official = calculateOfficialPricing(data.activeDoctors);
    const startDate = parseDateInputToUTC(data.startDate);
    const nextAdjustmentDate = data.nextAdjustmentDate?.trim()
      ? parseDateInputToUTC(data.nextAdjustmentDate)
      : addOneYearUTC(startDate);
    const contractStartDate = data.contractStartDate?.trim()
      ? parseDateInputToUTC(data.contractStartDate)
      : null;

    const clinic = await prisma.clinic.create({
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
        setupFeeCents: data.setupFeeCents,
        setupInstallments: data.setupInstallments ?? null,
        monthlyFeeCents: data.monthlyFeeCents,
        dueDay: data.dueDay,
        startDate,
        nextAdjustmentDate,
        contractStartDate,
        fidelityMonths: data.fidelityMonths ?? null,
        contractStatus: data.contractStatus,
        infraType: data.infraType,
        infraCostCents: data.infraCostCents,
        technicalNotes: data.technicalNotes?.trim() || null,
      },
    });

    return NextResponse.json({ clinic }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Este subdomínio já está vinculado a outra clínica." },
        { status: 409 }
      );
    }
    console.error("[api/clinics POST] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao cadastrar clínica." },
      { status: 500 }
    );
  }
}
