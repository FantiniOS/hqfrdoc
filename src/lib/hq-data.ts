import { ensureMonthlyInvoicesForCompetence } from "@/lib/billing-automation";
import {
  getLastNCompetences,
  getShortCompetenceLabel,
  getTodaySaoPaulo,
  isValidCompetence,
} from "@/lib/format";
import { computeInvoiceDisplayStatus, getTierCeilingAlert } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export async function getOrCreateSettings() {
  return prisma.hqSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      taxRatePercent: 6.0,
      taxRegimeLabel: "Simples Nacional — Anexo III",
      pixKey: "",
      pixKeyType: "CNPJ",
      pixHolderName: "FRdoc",
      companyName: "FRdoc",
      contractCourt: "Contagem/MG",
      defaultFidelityMonths: 12,
      defaultFidelityPenaltyPct: 30,
      defaultSuspensionDays: 15,
      supportChannel: "WhatsApp",
      supportHours: "Segunda a sexta, das 08h às 18h",
    },
  });
}

export async function getDashboardData(competenceInput?: string) {
  const today = getTodaySaoPaulo();
  const competence =
    competenceInput && isValidCompetence(competenceInput)
      ? competenceInput
      : today.competence;

  // Automação idempotente: garante que as mensalidades do mês corrente existam
  if (competence === today.competence) {
    await ensureMonthlyInvoicesForCompetence(today.competence);
  }

  const sixCompetences = getLastNCompetences(competence, 6);

  const [clinics, fixedCosts, settings, monthInvoices, chartInvoices, allOpenInvoices] =
    await Promise.all([
      prisma.clinic.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.fixedCost.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      getOrCreateSettings(),
      prisma.invoice.findMany({
        where: { competence },
        include: { clinic: true },
        orderBy: { dueDate: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          competence: { in: sixCompetences },
          status: "PAID",
        },
        select: {
          competence: true,
          amountCents: true,
        },
      }),
      prisma.invoice.findMany({
        where: { status: "OPEN" },
        include: { clinic: true },
        orderBy: { dueDate: "asc" },
      }),
    ]);

  const activeClinics = clinics.filter((c) => c.status === "ACTIVE");
  const delinquentClinics = clinics.filter((c) => c.status === "DELINQUENT");
  const mrrCents = activeClinics.reduce((sum, c) => sum + c.monthlyFeeCents, 0);
  const activeDoctorsTotal = activeClinics.reduce((sum, c) => sum + c.activeDoctors, 0);

  const clinicInfraCents = clinics
    .filter((c) => c.status !== "CANCELED")
    .reduce((sum, c) => sum + c.infraCostCents, 0);

  const fixedCostsCents = fixedCosts.reduce((sum, f) => sum + f.monthlyAmountCents, 0);

  const paidMonthInvoices = monthInvoices.filter((inv) => inv.status === "PAID");
  const receivedCents = paidMonthInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);
  const receivedMonthlyCents = paidMonthInvoices
    .filter((inv) => inv.type === "MONTHLY")
    .reduce((sum, inv) => sum + inv.amountCents, 0);
  const receivedExtrasCents = receivedCents - receivedMonthlyCents;

  const openMonthInvoices = monthInvoices.filter((inv) => inv.status === "OPEN");
  const pendingMonthCents = openMonthInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);

  const annotatedOpenInvoices = allOpenInvoices.map((inv) => {
    const computed = computeInvoiceDisplayStatus(inv.status, inv.dueDate);
    return {
      ...inv,
      displayStatus: computed.displayStatus,
      daysDiff: computed.daysDiff,
      statusLabel: computed.label,
    };
  });

  const overdueInvoices = annotatedOpenInvoices.filter((inv) => inv.daysDiff < 0);
  const overdueCents = overdueInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);
  const overdueCount = overdueInvoices.length;

  const overduePriorMonthsCents = overdueInvoices
    .filter((inv) => inv.competence !== competence)
    .reduce((sum, inv) => sum + inv.amountCents, 0);
  const receivableTotalCents = pendingMonthCents + overduePriorMonthsCents;

  const quickActionInvoices = annotatedOpenInvoices
    .filter((inv) => inv.daysDiff <= 5)
    .map((inv) => ({
      id: inv.id,
      publicToken: inv.publicToken,
      clinicId: inv.clinicId,
      clinicName: inv.clinic.name,
      responsibleName: inv.clinic.responsibleName,
      whatsapp: inv.clinic.whatsapp,
      type: inv.type,
      competence: inv.competence,
      description: inv.description,
      amountCents: inv.amountCents,
      dueDate: inv.dueDate.toISOString(),
      status: inv.status,
      displayStatus: inv.displayStatus,
      daysDiff: inv.daysDiff,
      statusLabel: inv.statusLabel,
    }));

  const taxRatePercent = settings.taxRatePercent;
  const taxCents = Math.round(receivedCents * (taxRatePercent / 100));
  const totalCostsAndTaxesCents = clinicInfraCents + fixedCostsCents + taxCents;

  const netProfitCents = receivedCents - totalCostsAndTaxesCents;
  const profitMarginPercent =
    receivedCents > 0 ? (netProfitCents / receivedCents) * 100 : 0;

  const upgradeAlerts = clinics
    .filter((c) => c.status === "ACTIVE" || c.status === "ONBOARDING")
    .map((c) => ({
      clinicId: c.id,
      clinicName: c.name,
      activeDoctors: c.activeDoctors,
      planTier: c.planTier,
      alert: getTierCeilingAlert(c.planTier, c.activeDoctors),
    }))
    .filter((item) => item.alert.show);

  const paidByCompetence = new Map<string, number>();
  for (const inv of chartInvoices) {
    paidByCompetence.set(
      inv.competence,
      (paidByCompetence.get(inv.competence) ?? 0) + inv.amountCents
    );
  }

  const baseOperationalCostsCents = clinicInfraCents + fixedCostsCents;
  const chartSeries = sixCompetences.map((comp) => {
    const revCents = paidByCompetence.get(comp) ?? 0;
    const compTaxCents = Math.round(revCents * (taxRatePercent / 100));
    const compCostsAndTaxesCents = baseOperationalCostsCents + compTaxCents;
    const compProfitCents = revCents - compCostsAndTaxesCents;

    return {
      competence: comp,
      label: getShortCompetenceLabel(comp),
      receivedCents: revCents,
      costsAndTaxesCents: compCostsAndTaxesCents,
      netProfitCents: compProfitCents,
      received: Number((revCents / 100).toFixed(2)),
      costsAndTaxes: Number((compCostsAndTaxesCents / 100).toFixed(2)),
      netProfit: Number((compProfitCents / 100).toFixed(2)),
    };
  });

  return {
    competence,
    todayYmd: today.ymd,
    kpis: {
      mrrCents,
      activeClinicsCount: activeClinics.length,
      delinquentClinicsCount: delinquentClinics.length,
      totalClinicsCount: clinics.length,
      activeDoctorsTotal,
      receivedCents,
      receivedMonthlyCents,
      receivedExtrasCents,
      paidCount: paidMonthInvoices.length,
      receivableTotalCents,
      pendingMonthCents,
      openMonthCount: openMonthInvoices.length,
      overdueCents,
      overdueCount,
      clinicInfraCents,
      fixedCostsCents,
      taxCents,
      taxRatePercent,
      taxRegimeLabel: settings.taxRegimeLabel,
      totalCostsAndTaxesCents,
      netProfitCents,
      profitMarginPercent,
    },
    quickActionInvoices,
    upgradeAlerts,
    chartSeries,
    settings: {
      taxRatePercent: settings.taxRatePercent,
      taxRegimeLabel: settings.taxRegimeLabel,
      pixKey: settings.pixKey,
      pixKeyType: settings.pixKeyType,
      pixHolderName: settings.pixHolderName,
      companyName: settings.companyName,
    },
  };
}
