import type {
  ClinicStatus,
  InfraType,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PlanTier,
} from "@prisma/client";
import { getDaysDiffFromToday } from "@/lib/format";

export interface PricingSuggestion {
  tier: PlanTier;
  tierLabel: string;
  tierRangeLabel: string;
  setupFeeCents: number;
  monthlyFeeCents: number;
  maxDoctorsInTier: number | null;
  isAtTierCeiling: boolean;
  nextTierLabel: string | null;
  formulaSummary: string;
}

/**
 * Tabela Oficial de Precificação FRdoc 2.0:
 * - Pequena (1 a 2 médicos): Setup R$ 1.800 | Mensalidade R$ 790/mês
 * - Média (3 a 6 médicos): Setup R$ 3.200 | Mensalidade R$ 1.290/mês + R$ 190 por médico acima de 3
 * - Grande (7 a 15 médicos): Setup R$ 5.500 | Mensalidade R$ 2.690/mês + R$ 160 por médico acima de 7
 * - Enterprise (acima de 15 médicos): Setup R$ 7.500 | Mensalidade R$ 3.970/mês + R$ 140 por médico acima de 15
 */
export function calculateOfficialPricing(activeDoctorsInput: number): PricingSuggestion {
  const doctors = Math.max(1, Math.trunc(Number.isFinite(activeDoctorsInput) ? activeDoctorsInput : 1));

  if (doctors <= 2) {
    return {
      tier: "SMALL",
      tierLabel: "Pequena",
      tierRangeLabel: "1 a 2 médicos",
      setupFeeCents: 180_000,
      monthlyFeeCents: 79_000,
      maxDoctorsInTier: 2,
      isAtTierCeiling: doctors === 2,
      nextTierLabel: "Média",
      formulaSummary: "Fixo R$ 790/mês (até 2 médicos)",
    };
  }

  if (doctors <= 6) {
    const extra = doctors - 3;
    const monthlyFeeCents = 129_000 + extra * 19_000;
    return {
      tier: "MEDIUM",
      tierLabel: "Média",
      tierRangeLabel: "3 a 6 médicos",
      setupFeeCents: 320_000,
      monthlyFeeCents,
      maxDoctorsInTier: 6,
      isAtTierCeiling: doctors === 6,
      nextTierLabel: "Grande",
      formulaSummary:
        extra > 0
          ? `Base R$ 1.290 + ${extra} × R$ 190`
          : "Base R$ 1.290/mês (3 médicos)",
    };
  }

  if (doctors <= 15) {
    const extra = doctors - 7;
    const monthlyFeeCents = 269_000 + extra * 16_000;
    return {
      tier: "LARGE",
      tierLabel: "Grande",
      tierRangeLabel: "7 a 15 médicos",
      setupFeeCents: 550_000,
      monthlyFeeCents,
      maxDoctorsInTier: 15,
      isAtTierCeiling: doctors === 15,
      nextTierLabel: "Enterprise",
      formulaSummary:
        extra > 0
          ? `Base R$ 2.690 + ${extra} × R$ 160`
          : "Base R$ 2.690/mês (7 médicos)",
    };
  }

  const extra = doctors - 15;
  const monthlyFeeCents = 397_000 + extra * 14_000;
  return {
    tier: "ENTERPRISE",
    tierLabel: "Enterprise",
    tierRangeLabel: "Acima de 15 médicos",
    setupFeeCents: 750_000,
    monthlyFeeCents,
    maxDoctorsInTier: null,
    isAtTierCeiling: false,
    nextTierLabel: null,
    formulaSummary: `Base R$ 3.970 + ${extra} × R$ 140`,
  };
}

export interface TierCeilingAlert {
  show: boolean;
  ratioLabel: string;
  message: string;
  nextTierLabel: string | null;
}

export function getTierCeilingAlert(planTier: PlanTier, activeDoctors: number): TierCeilingAlert {
  if (planTier === "SMALL" && activeDoctors >= 2) {
    return {
      show: true,
      ratioLabel: `${activeDoctors}/2`,
      message:
        activeDoctors === 2
          ? "Teto da faixa Pequena (2/2) — potencial upgrade para Média"
          : `Acima do teto da faixa Pequena (${activeDoctors}/2) — revisar upgrade para Média`,
      nextTierLabel: "Média",
    };
  }
  if (planTier === "MEDIUM" && activeDoctors >= 6) {
    return {
      show: true,
      ratioLabel: `${activeDoctors}/6`,
      message:
        activeDoctors === 6
          ? "Teto da faixa Média (6/6) — potencial upgrade para Grande"
          : `Acima do teto da faixa Média (${activeDoctors}/6) — revisar upgrade para Grande`,
      nextTierLabel: "Grande",
    };
  }
  if (planTier === "LARGE" && activeDoctors >= 15) {
    return {
      show: true,
      ratioLabel: `${activeDoctors}/15`,
      message:
        activeDoctors === 15
          ? "Teto da faixa Grande (15/15) — potencial upgrade para Enterprise"
          : `Acima do teto da faixa Grande (${activeDoctors}/15) — revisar upgrade para Enterprise`,
      nextTierLabel: "Enterprise",
    };
  }
  return {
    show: false,
    ratioLabel: "",
    message: "",
    nextTierLabel: null,
  };
}

export const PLAN_TIER_LABELS: Record<PlanTier, { label: string; range: string }> = {
  SMALL: { label: "Pequena", range: "1–2 médicos" },
  MEDIUM: { label: "Média", range: "3–6 médicos" },
  LARGE: { label: "Grande", range: "7–15 médicos" },
  ENTERPRISE: { label: "Enterprise", range: "16+ médicos" },
};

export const CLINIC_STATUS_META: Record<
  ClinicStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  ACTIVE: {
    label: "Ativa",
    badgeClass: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
    dotClass: "bg-emerald-400",
  },
  ONBOARDING: {
    label: "Implantação",
    badgeClass: "bg-sky-500/12 text-sky-300 border-sky-500/25",
    dotClass: "bg-sky-400",
  },
  DELINQUENT: {
    label: "Inadimplente",
    badgeClass: "bg-rose-500/12 text-rose-300 border-rose-500/25",
    dotClass: "bg-rose-400",
  },
  PAUSED: {
    label: "Pausada",
    badgeClass: "bg-amber-500/12 text-amber-300 border-amber-500/25",
    dotClass: "bg-amber-400",
  },
  CANCELED: {
    label: "Cancelada",
    badgeClass: "bg-slate-500/12 text-slate-400 border-slate-500/25",
    dotClass: "bg-slate-400",
  },
};

export const INFRA_TYPE_LABELS: Record<InfraType, string> = {
  ORACLE_ALWAYS_FREE: "Oracle Always Free",
  ORACLE_DEDICATED_VM: "VM Oracle Dedicada",
  PAID_DEDICATED_DB: "Banco Pago Dedicado",
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  MONTHLY: "Mensalidade",
  SETUP: "Setup Inicial",
  MIGRATION: "Migração de Base",
  EXTRA_TRAINING: "Treinamento Extra",
  PDF_CUSTOMIZATION: "Personalização de PDF",
  OTHER_SERVICE: "Serviço Opcional",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARD: "Cartão",
  TRANSFER: "Transferência",
};

export type InvoiceDisplayStatus = "PAID" | "OPEN" | "DUE_SOON" | "OVERDUE" | "CANCELED";

export function computeInvoiceDisplayStatus(
  status: InvoiceStatus,
  dueDate: Date | string
): {
  displayStatus: InvoiceDisplayStatus;
  daysDiff: number;
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  const daysDiff = getDaysDiffFromToday(dueDate);

  if (status === "PAID") {
    return {
      displayStatus: "PAID",
      daysDiff,
      label: "Pago",
      badgeClass: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
      dotClass: "bg-emerald-400",
    };
  }

  if (status === "CANCELED") {
    return {
      displayStatus: "CANCELED",
      daysDiff,
      label: "Cancelado",
      badgeClass: "bg-slate-500/12 text-slate-400 border-slate-500/25",
      dotClass: "bg-slate-400",
    };
  }

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    return {
      displayStatus: "OVERDUE",
      daysDiff,
      label: overdueDays === 1 ? "Atrasado (1 dia)" : `Atrasado (${overdueDays} dias)`,
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      dotClass: "bg-rose-400",
    };
  }

  if (daysDiff <= 3) {
    return {
      displayStatus: "DUE_SOON",
      daysDiff,
      label:
        daysDiff === 0
          ? "Vence hoje"
          : daysDiff === 1
            ? "Vence amanhã"
            : `Vence em ${daysDiff} dias`,
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      dotClass: "bg-amber-400",
    };
  }

  return {
    displayStatus: "OPEN",
    daysDiff,
    label: "Em Aberto",
    badgeClass: "bg-sky-500/12 text-sky-300 border-sky-500/25",
    dotClass: "bg-sky-400",
  };
}
