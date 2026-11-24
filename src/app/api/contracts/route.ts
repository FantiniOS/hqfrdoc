import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { buildContractPayload, generateContractToken } from "@/lib/contract";
import { parseDateInputToUTC } from "@/lib/format";
import { getOrCreateSettings } from "@/lib/hq-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const generateContractSchema = z.object({
  clinicId: z.string().min(1, "Informe a clínica."),
  startDate: z.string().optional().nullable(),
  fidelityMonths: z.coerce.number().int().min(1).max(60).optional().nullable(),
  setupInstallments: z.coerce.number().int().min(1).max(12).optional().nullable(),
});

export async function GET(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinicId")?.trim();

    const contracts = await prisma.contract.findMany({
      where: clinicId ? { clinicId } : undefined,
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            legalName: true,
            cnpj: true,
            whatsapp: true,
            responsibleName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { contracts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/contracts GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao listar contratos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = generateContractSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { clinicId, startDate, fidelityMonths, setupInstallments } = parsed.data;

    const [clinic, settings] = await Promise.all([
      prisma.clinic.findUnique({ where: { id: clinicId } }),
      getOrCreateSettings(),
    ]);

    if (!clinic) {
      return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    }

    const effectiveContractStart = startDate?.trim()
      ? parseDateInputToUTC(startDate)
      : clinic.contractStartDate ?? clinic.startDate;

    const effectiveFidelity =
      fidelityMonths ?? clinic.fidelityMonths ?? settings.defaultFidelityMonths;
    const effectiveInstallments =
      setupInstallments ?? clinic.setupInstallments ?? 1;

    const built = buildContractPayload(
      {
        ...clinic,
        contractStartDate: effectiveContractStart,
        fidelityMonths: effectiveFidelity,
        setupInstallments: effectiveInstallments,
      },
      settings
    );

    const token = generateContractToken();

    const [contract] = await prisma.$transaction([
      prisma.contract.create({
        data: {
          clinicId: clinic.id,
          token,
          status: "SENT",
          contentSnapshot: built.contentSnapshot,
          documentHash: built.documentHash,
          planSnapshot: built.planSnapshot,
          monthlyFeeSnapshot: built.monthlyFeeSnapshot,
          setupFeeSnapshot: built.setupFeeSnapshot,
          setupInstallments: built.setupInstallments,
          isFounderSnapshot: built.isFounderSnapshot,
          dueDaySnapshot: built.dueDaySnapshot,
          infraSnapshot: built.infraSnapshot,
          penaltyPctSnapshot: built.penaltyPctSnapshot,
          courtSnapshot: built.courtSnapshot,
          clinicLegalNameSnapshot: built.clinicLegalNameSnapshot,
          clinicCnpjSnapshot: built.clinicCnpjSnapshot,
          clinicSubdomainSnapshot: built.clinicSubdomainSnapshot,
          hqLegalNameSnapshot: built.hqLegalNameSnapshot,
          hqCnpjSnapshot: built.hqCnpjSnapshot,
          fidelityMonths: built.fidelityMonths,
          startDate: built.startDate,
          endDate: built.endDate,
        },
      }),
      prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          contractStatus: "SENT",
          contractStartDate: effectiveContractStart,
          fidelityMonths: effectiveFidelity,
          setupInstallments: effectiveInstallments,
        },
      }),
    ]);

    return NextResponse.json(
      {
        contract,
        missingFields: built.missingFields,
        signPath: `/assinar/${contract.token}`,
        pdfPath: `/api/contracts/${contract.id}/pdf`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/contracts POST] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao gerar contrato congelado." },
      { status: 500 }
    );
  }
}
