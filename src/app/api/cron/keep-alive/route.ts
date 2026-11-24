import { NextResponse } from "next/server";
import { verifyCronAuthorization } from "@/lib/auth-server";
import { ensureMonthlyInvoicesForCompetence } from "@/lib/billing-automation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyCronAuthorization(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message },
      { status: auth.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const recurrence = await ensureMonthlyInvoicesForCompetence();

    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        recurrence,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[cron/keep-alive] Falha:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao executar rotina de keep-alive e recorrência.",
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
