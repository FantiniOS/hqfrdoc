import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-server";
import { getDashboardData } from "@/lib/hq-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const competence = searchParams.get("competence") ?? undefined;
    const data = await getDashboardData(competence);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/dashboard] Erro ao carregar visão geral:", err);
    return NextResponse.json(
      { error: "Erro ao carregar os indicadores do painel." },
      { status: 500 }
    );
  }
}
