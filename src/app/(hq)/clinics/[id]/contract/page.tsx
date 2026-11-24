import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContractClient } from "@/components/ContractClient";
import { getServerSession } from "@/lib/auth-server";
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
    return { title: "Contrato FRdoc 2.0 — FRdoc HQ" };
  }

  const { id } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: clinic
      ? `Contrato FRdoc 2.0 — ${clinic.name}`
      : "Contrato FRdoc 2.0 — FRdoc HQ",
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
    }),
    getOrCreateSettings(),
  ]);

  if (!clinic) {
    notFound();
  }

  return (
    <ContractClient
      clinic={{
        id: clinic.id,
        name: clinic.name,
        legalName: clinic.legalName,
        cnpj: clinic.cnpj,
        address: clinic.address,
        responsibleName: clinic.responsibleName,
        legalRepName: clinic.legalRepName,
        legalRepCpf: clinic.legalRepCpf,
        subdomain: clinic.subdomain,
        activeDoctors: clinic.activeDoctors,
        planTier: clinic.planTier,
        isFounder: clinic.isFounder,
        setupFeeCents: clinic.setupFeeCents,
        setupInstallments: clinic.setupInstallments,
        monthlyFeeCents: clinic.monthlyFeeCents,
        dueDay: clinic.dueDay,
        startDate: clinic.startDate.toISOString(),
        contractStartDate: clinic.contractStartDate
          ? clinic.contractStartDate.toISOString()
          : null,
        fidelityMonths: clinic.fidelityMonths,
        contractStatus: clinic.contractStatus,
        infraType: clinic.infraType,
      }}
      settings={{
        companyName: settings.companyName,
        companyLegalName: settings.companyLegalName,
        companyCnpj: settings.companyCnpj,
        companyAddress: settings.companyAddress,
        companyRepName: settings.companyRepName,
        companyRepCpf: settings.companyRepCpf,
        contractCourt: settings.contractCourt,
        defaultFidelityMonths: settings.defaultFidelityMonths,
        defaultFidelityPenaltyPct: settings.defaultFidelityPenaltyPct,
        defaultSuspensionDays: settings.defaultSuspensionDays,
        supportChannel: settings.supportChannel,
        supportHours: settings.supportHours,
      }}
    />
  );
}
