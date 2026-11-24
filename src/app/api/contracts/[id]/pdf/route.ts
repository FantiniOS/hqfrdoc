import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-server";
import { generateContractPdfBytes } from "@/lib/contract-pdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const contract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    const pdfBytes = await generateContractPdfBytes(contract);
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get("download") === "1";

    const safeSlug = (contract.clinicLegalNameSnapshot || "clinica")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48);

    const filename = `contrato-frdoc-${safeSlug || contract.id.slice(-6)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          forceDownload ? "attachment" : "inline"
        }; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/contracts/[id]/pdf GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao gerar arquivo PDF do contrato." },
      { status: 500 }
    );
  }
}
