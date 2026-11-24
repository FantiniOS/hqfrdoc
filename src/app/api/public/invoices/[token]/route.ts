import { NextResponse } from "next/server";
import { getOrCreateSettings } from "@/lib/hq-data";
import { buildPixBrCode, generatePixQrSvg } from "@/lib/pix";
import { computeInvoiceDisplayStatus, INVOICE_TYPE_LABELS } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const [invoice, settings] = await Promise.all([
      prisma.invoice.findUnique({
        where: { publicToken: token },
        include: {
          clinic: {
            select: {
              name: true,
              legalName: true,
              cnpj: true,
            },
          },
        },
      }),
      getOrCreateSettings(),
    ]);

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada ou link inválido." },
        { status: 404 }
      );
    }

    const computed = computeInvoiceDisplayStatus(invoice.status, invoice.dueDate);

    let pixBrCode: string | null = null;
    let pixQrSvg: string | null = null;

    if (invoice.status === "OPEN" && settings.pixKey?.trim()) {
      const txid = `FRDOC${invoice.id.replace(/[^a-zA-Z0-9]/g, "").slice(-16).toUpperCase()}`;
      pixBrCode = buildPixBrCode({
        pixKey: settings.pixKey,
        pixKeyType: settings.pixKeyType,
        merchantName: settings.pixHolderName || settings.companyName || "FRDOC",
        merchantCity: settings.contractCourt || "CONTAGEM",
        amountCents: invoice.amountCents,
        txid,
      });

      if (pixBrCode) {
        pixQrSvg = await generatePixQrSvg(pixBrCode);
      }
    }

    return NextResponse.json(
      {
        invoice: {
          id: invoice.id,
          publicToken: invoice.publicToken,
          typeLabel: INVOICE_TYPE_LABELS[invoice.type],
          competence: invoice.competence,
          description: invoice.description,
          amountCents: invoice.amountCents,
          dueDate: invoice.dueDate.toISOString(),
          status: invoice.status,
          paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
          displayStatus: computed.displayStatus,
          statusLabel: computed.label,
          clinicName: invoice.clinic.legalName || invoice.clinic.name,
          clinicTradeName: invoice.clinic.name,
          clinicCnpj: invoice.clinic.cnpj,
        },
        beneficiary: {
          companyName: settings.companyName || "FRdoc",
          holderName: settings.pixHolderName || settings.companyLegalName || "FRdoc",
          pixKey: settings.pixKey || "",
          pixKeyType: settings.pixKeyType || "CNPJ",
        },
        pix: {
          brCode: pixBrCode,
          qrSvg: pixQrSvg,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/public/invoices/[token] GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar fatura." },
      { status: 500 }
    );
  }
}
