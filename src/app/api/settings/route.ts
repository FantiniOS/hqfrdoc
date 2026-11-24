import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth-server";
import { getOrCreateSettings } from "@/lib/hq-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  taxRatePercent: z.coerce
    .number()
    .min(0, "Alíquota não pode ser negativa.")
    .max(50, "Alíquota máxima permitida: 50%."),
  taxRegimeLabel: z.string().trim().min(2, "Informe o rótulo do regime fiscal."),
  pixKey: z.string().trim().max(160),
  pixKeyType: z.string().trim().min(1).max(32),
  pixHolderName: z.string().trim().max(120),
  companyName: z.string().trim().min(1).max(80).default("FRdoc"),

  // Dados da Contratada & Regras de Contrato
  companyLegalName: z.string().trim().max(200).optional().nullable(),
  companyCnpj: z.string().trim().max(32).optional().nullable(),
  companyAddress: z.string().trim().max(300).optional().nullable(),
  companyRepName: z.string().trim().max(160).optional().nullable(),
  companyRepCpf: z.string().trim().max(24).optional().nullable(),
  contractCourt: z.string().trim().min(2, "Informe o foro do contrato.").max(120).default("Contagem/MG"),
  defaultFidelityMonths: z.coerce.number().int().min(0).max(60).default(12),
  defaultFidelityPenaltyPct: z.coerce.number().int().min(0).max(100).default(30),
  defaultSuspensionDays: z.coerce.number().int().min(1).max(90).default(15),
  supportChannel: z.string().trim().min(2, "Informe o canal de suporte.").max(120).default("WhatsApp"),
  supportHours: z
    .string()
    .trim()
    .min(2, "Informe o horário de suporte.")
    .max(160)
    .default("Segunda a sexta, das 08h às 18h"),
});

export async function GET() {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/settings GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar configurações." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Configurações inválidas." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const payload = {
      taxRatePercent: data.taxRatePercent,
      taxRegimeLabel: data.taxRegimeLabel,
      pixKey: data.pixKey,
      pixKeyType: data.pixKeyType,
      pixHolderName: data.pixHolderName,
      companyName: data.companyName,
      companyLegalName: data.companyLegalName?.trim() || null,
      companyCnpj: data.companyCnpj?.trim() || null,
      companyAddress: data.companyAddress?.trim() || null,
      companyRepName: data.companyRepName?.trim() || null,
      companyRepCpf: data.companyRepCpf?.trim() || null,
      contractCourt: data.contractCourt,
      defaultFidelityMonths: data.defaultFidelityMonths,
      defaultFidelityPenaltyPct: data.defaultFidelityPenaltyPct,
      defaultSuspensionDays: data.defaultSuspensionDays,
      supportChannel: data.supportChannel,
      supportHours: data.supportHours,
    };

    const settings = await prisma.hqSettings.upsert({
      where: { id: "default" },
      update: payload,
      create: {
        id: "default",
        ...payload,
      },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[api/settings PUT] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 }
    );
  }
}
