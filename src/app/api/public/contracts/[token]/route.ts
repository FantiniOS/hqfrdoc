import { NextResponse } from "next/server";
import { z } from "zod";
import { computeSha256Hex } from "@/lib/contract";
import { generateContractPdfBytes } from "@/lib/contract-pdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isValidCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(digits[i]) * (10 - i);
  }
  let check1 = (sum1 * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== Number(digits[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(digits[i]) * (11 - i);
  }
  let check2 = (sum2 * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === Number(digits[10]);
}

function formatCpfMask(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw.trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

const signPayloadSchema = z.object({
  signerName: z
    .string()
    .trim()
    .min(5, "Informe o nome completo do representante legal."),
  signerCpf: z
    .string()
    .trim()
    .refine(isValidCpf, "Informe um CPF válido (11 dígitos)."),
  acceptedTerms: z.literal(true, {
    message: "Confirme o aceite expresso dos termos contratuais.",
  }),
  signatureDataUrl: z
    .string()
    .max(700_000, "Imagem da assinatura excede o tamanho máximo.")
    .optional()
    .nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const contract = await prisma.contract.findUnique({
      where: { token },
      include: {
        clinic: {
          select: {
            name: true,
            legalRepName: true,
            legalRepCpf: true,
            responsibleName: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado ou link inválido." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("format") === "pdf") {
      if (contract.status !== "SIGNED") {
        return NextResponse.json(
          { error: "O PDF público fica disponível após a assinatura eletrônica." },
          { status: 403 }
        );
      }

      const pdfBytes = await generateContractPdfBytes(contract);
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="contrato-assinado-frdoc-${contract.id.slice(-6)}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      {
        contract: {
          id: contract.id,
          token: contract.token,
          status: contract.status,
          contentSnapshot: contract.contentSnapshot,
          documentHash: contract.documentHash,
          planSnapshot: contract.planSnapshot,
          monthlyFeeSnapshot: contract.monthlyFeeSnapshot,
          setupFeeSnapshot: contract.setupFeeSnapshot,
          setupInstallments: contract.setupInstallments,
          isFounderSnapshot: contract.isFounderSnapshot,
          dueDaySnapshot: contract.dueDaySnapshot,
          infraSnapshot: contract.infraSnapshot,
          penaltyPctSnapshot: contract.penaltyPctSnapshot,
          courtSnapshot: contract.courtSnapshot,
          clinicName: contract.clinic.name,
          clinicLegalNameSnapshot: contract.clinicLegalNameSnapshot,
          clinicCnpjSnapshot: contract.clinicCnpjSnapshot,
          clinicSubdomainSnapshot: contract.clinicSubdomainSnapshot,
          hqLegalNameSnapshot: contract.hqLegalNameSnapshot,
          hqCnpjSnapshot: contract.hqCnpjSnapshot,
          fidelityMonths: contract.fidelityMonths,
          startDate: contract.startDate.toISOString(),
          endDate: contract.endDate.toISOString(),
          signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
          signerName: contract.signerName,
          signerCpf: contract.signerCpf,
          signerIp: contract.signerIp,
          suggestedSignerName:
            contract.clinic.legalRepName || contract.clinic.responsibleName || "",
          suggestedSignerCpf: contract.clinic.legalRepCpf || "",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/public/contracts/[token] GET] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar o contrato." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const contract = await prisma.contract.findUnique({
      where: { token },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    if (contract.status === "SIGNED") {
      return NextResponse.json(
        { error: "Este contrato já foi assinado e está bloqueado para alterações." },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = signPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados de assinatura inválidos." },
        { status: 400 }
      );
    }

    // Verifica integridade do SHA-256 do texto congelado antes de registrar assinatura
    const currentHash = computeSha256Hex(contract.contentSnapshot);
    if (currentHash !== contract.documentHash) {
      return NextResponse.json(
        { error: "Falha na verificação de integridade SHA-256 do documento." },
        { status: 500 }
      );
    }

    const signedAt = new Date();
    const signerIp = extractClientIp(request);
    const signerUserAgent =
      (request.headers.get("user-agent") ?? "Desconhecido").slice(0, 350);
    const formattedCpf = formatCpfMask(parsed.data.signerCpf);
    const cleanSignature =
      parsed.data.signatureDataUrl &&
      parsed.data.signatureDataUrl.startsWith("data:image/png;base64,")
        ? parsed.data.signatureDataUrl
        : null;

    const [updated] = await prisma.$transaction([
      prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: "SIGNED",
          signedAt,
          signerName: parsed.data.signerName,
          signerCpf: formattedCpf,
          signerIp,
          signerUserAgent,
          signatureDataUrl: cleanSignature,
        },
      }),
      prisma.clinic.update({
        where: { id: contract.clinicId },
        data: {
          contractStatus: "SIGNED",
          legalRepName: parsed.data.signerName,
          legalRepCpf: formattedCpf,
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        signedAt: updated.signedAt?.toISOString(),
        signerIp: updated.signerIp,
        documentHash: updated.documentHash,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/public/contracts/[token] POST] Erro:", err);
    return NextResponse.json(
      { error: "Não foi possível concluir a assinatura eletrônica." },
      { status: 500 }
    );
  }
}
