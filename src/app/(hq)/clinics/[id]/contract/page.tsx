import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContractClient } from "@/components/ContractClient";
import { getServerSession } from "@/lib/auth-server";
import { buildContractPayload } from "@/lib/contract";
import { getOrCreateSettings } from "@/lib/hq-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await getServerSession();
  if (!session) {
    return { title: "Contrato — FRdoc HQ" };
  }

  const { id } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: clinic ? `Contrato — ${clinic.name}` : "Contrato — FRdoc HQ",
  };
}

export default async function ClinicContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const [clinic, settings] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id },
      include: {
        contracts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    getOrCreateSettings(),
  ]);

  if (!clinic) {
    notFound();
  }

  const previewBuilt = buildContractPayload(clinic, settings);
  const latest = clinic.contracts[0] ?? null;

  return (
    <ContractClient
      clinic={{
        id: clinic.id,
        name: clinic.name,
        whatsapp: clinic.whatsapp,
        responsibleName: clinic.responsibleName,
      }}
      latestContract={
        latest
          ? {
              id: latest.id,
              token: latest.token,
              status: latest.status,
              contentSnapshot: latest.contentSnapshot,
              documentHash: latest.documentHash,
              planSnapshot: latest.planSnapshot,
              monthlyFeeSnapshot: latest.monthlyFeeSnapshot,
              setupFeeSnapshot: latest.setupFeeSnapshot,
              setupInstallments: latest.setupInstallments,
              isFounderSnapshot: latest.isFounderSnapshot,
              dueDaySnapshot: latest.dueDaySnapshot,
              infraSnapshot: latest.infraSnapshot,
              fidelityMonths: latest.fidelityMonths,
              startDate: latest.startDate.toISOString(),
              endDate: latest.endDate.toISOString(),
              signedAt: latest.signedAt ? latest.signedAt.toISOString() : null,
              signerName: latest.signerName,
              signerCpf: latest.signerCpf,
              signerIp: latest.signerIp,
              signerUserAgent: latest.signerUserAgent,
              createdAt: latest.createdAt.toISOString(),
            }
          : null
      }
      missingFields={previewBuilt.missingFields}
    />
  );
}
