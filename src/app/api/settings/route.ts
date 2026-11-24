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
    const settings = await prisma.hqSettings.upsert({
      where: { id: "default" },
      update: {
        taxRatePercent: data.taxRatePercent,
        taxRegimeLabel: data.taxRegimeLabel,
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType,
        pixHolderName: data.pixHolderName,
        companyName: data.companyName,
      },
      create: {
        id: "default",
        taxRatePercent: data.taxRatePercent,
        taxRegimeLabel: data.taxRegimeLabel,
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType,
        pixHolderName: data.pixHolderName,
        companyName: data.companyName,
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
