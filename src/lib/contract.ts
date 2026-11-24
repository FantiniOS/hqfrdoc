import type { InfraType, PlanTier } from "@prisma/client";
import {
  addMonthsUTC,
  formatBRL,
  formatDateBR,
  formatDateLongBR,
  getTodaySaoPaulo,
  parseDateInputToUTC,
} from "@/lib/format";
import { INFRA_TYPE_LABELS, PLAN_TIER_LABELS } from "@/lib/pricing";

export type ContractStatusValue = "DRAFT" | "SENT" | "SIGNED";

export const CONTRACT_STATUS_OPTIONS: ContractStatusValue[] = [
  "DRAFT",
  "SENT",
  "SIGNED",
];

export const CONTRACT_STATUS_META: Record<
  ContractStatusValue,
  { label: string; badgeClass: string; dotClass: string }
> = {
  DRAFT: {
    label: "Rascunho",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  },
  SENT: {
    label: "Enviado",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  SIGNED: {
    label: "Assinado",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
};

export function normalizeContractStatus(status?: string | null): ContractStatusValue {
  if (status === "SENT" || status === "SIGNED" || status === "DRAFT") {
    return status;
  }
  return "DRAFT";
}

export function getTierDoctorRangeText(planTier: PlanTier): string {
  switch (planTier) {
    case "SMALL":
      return "1 a 2";
    case "MEDIUM":
      return "3 a 6";
    case "LARGE":
      return "7 a 15";
    case "ENTERPRISE":
      return "16 ou mais";
  }
}

export function getFidelityEndDate(
  startDate: Date | string | null | undefined,
  fidelityMonths: number
): Date | null {
  if (!startDate) return null;
  const parsed = typeof startDate === "string" ? new Date(startDate) : startDate;
  if (Number.isNaN(parsed.getTime())) return null;
  const safeMonths = Math.max(1, Math.trunc(fidelityMonths || 12));
  return addMonthsUTC(parsed, safeMonths);
}

export function formatSetupInstallmentsLabel(
  setupFeeCents: number,
  installments: number | null | undefined
): string {
  if (setupFeeCents <= 0) {
    return "Isento";
  }
  const n = Math.trunc(installments ?? 1);
  if (n <= 1) {
    return "Pagamento único (à vista)";
  }
  const installmentCents = Math.round(setupFeeCents / n);
  return `${n}x de ${formatBRL(installmentCents)}`;
}

export interface ContractSettingsInput {
  companyName: string;
  companyLegalName: string | null;
  companyCnpj: string | null;
  companyAddress: string | null;
  companyRepName: string | null;
  companyRepCpf: string | null;
  contractCourt: string;
  defaultFidelityMonths: number;
  defaultFidelityPenaltyPct: number;
  defaultSuspensionDays: number;
  supportChannel: string;
  supportHours: string;
}

export interface ContractClinicInput {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  address: string | null;
  responsibleName: string;
  legalRepName: string | null;
  legalRepCpf: string | null;
  subdomain: string | null;
  activeDoctors: number;
  planTier: PlanTier;
  isFounder: boolean;
  setupFeeCents: number;
  setupInstallments: number | null;
  monthlyFeeCents: number;
  dueDay: number;
  startDate: string;
  contractStartDate: string | null;
  fidelityMonths: number | null;
  contractStatus: string;
  infraType: InfraType;
}

export interface MissingFieldItem {
  key: string;
  label: string;
  source: "settings" | "clinic";
}

export interface ResolvedContractData {
  variables: {
    HQ_RAZAO_SOCIAL: string;
    HQ_CNPJ: string;
    HQ_ENDERECO: string;
    HQ_REPRESENTANTE: string;
    HQ_CPF_REPRESENTANTE: string;
    CLINICA_RAZAO_SOCIAL: string;
    CLINICA_CNPJ: string;
    CLINICA_ENDERECO: string;
    CLINICA_RESPONSAVEL: string;
    CLINICA_CPF_RESPONSAVEL: string;
    CLINICA_SUBDOMINIO: string;
    DIA_VENCIMENTO: string;
    DIAS_SUSPENSAO: string;
    MESES_FIDELIDADE: string;
    PERCENTUAL_MULTA_FIDELIDADE: string;
    CANAL_SUPORTE: string;
    HORARIO_SUPORTE: string;
    FORO_CONTRATO: string;
    DATA_CONTRATO: string;
    FAIXA_PLANO: string;
    LIMITE_MEDICOS: string;
    IS_FOUNDER_LABEL: string;
    VALOR_MENSAL_FORMATADO: string;
    VALOR_SETUP_FORMATADO: string;
    PARCELAMENTO_SETUP: string;
    DATA_INICIO: string;
    DATA_FIM_FIDELIDADE: string;
    INFRA_DESCRICAO: string;
  };
  missingFields: MissingFieldItem[];
}

export const PLACEHOLDER_TAG = "[PREENCHER]";

export function resolveContractData(
  clinic: ContractClinicInput,
  settings: ContractSettingsInput
): ResolvedContractData {
  const missingFields: MissingFieldItem[] = [];

  const requireField = (
    value: string | null | undefined,
    key: string,
    label: string,
    source: "settings" | "clinic"
  ): string => {
    const trimmed = value?.trim();
    if (!trimmed) {
      missingFields.push({ key, label, source });
      return PLACEHOLDER_TAG;
    }
    return trimmed;
  };

  const fidelityMonths =
    clinic.fidelityMonths && clinic.fidelityMonths > 0
      ? clinic.fidelityMonths
      : settings.defaultFidelityMonths || 12;

  const effectiveStartDateStr = clinic.contractStartDate ?? clinic.startDate;
  const effectiveStartDate = effectiveStartDateStr
    ? new Date(effectiveStartDateStr)
    : parseDateInputToUTC(getTodaySaoPaulo().ymd);

  const fidelityEndDate = getFidelityEndDate(effectiveStartDate, fidelityMonths);

  const subdomainFormatted = clinic.subdomain?.trim()
    ? `https://${clinic.subdomain.trim().replace(/^https?:\/\//, "")}`
    : null;

  const clinicRep = clinic.legalRepName?.trim() || clinic.responsibleName?.trim();

  const variables = {
    HQ_RAZAO_SOCIAL: requireField(
      settings.companyLegalName,
      "companyLegalName",
      "Razão Social da Contratada",
      "settings"
    ),
    HQ_CNPJ: requireField(
      settings.companyCnpj,
      "companyCnpj",
      "CNPJ da Contratada",
      "settings"
    ),
    HQ_ENDERECO: requireField(
      settings.companyAddress,
      "companyAddress",
      "Endereço da Contratada",
      "settings"
    ),
    HQ_REPRESENTANTE: requireField(
      settings.companyRepName,
      "companyRepName",
      "Representante Legal da Contratada",
      "settings"
    ),
    HQ_CPF_REPRESENTANTE: requireField(
      settings.companyRepCpf,
      "companyRepCpf",
      "CPF do Representante da Contratada",
      "settings"
    ),
    CLINICA_RAZAO_SOCIAL: requireField(
      clinic.legalName,
      "legalName",
      "Razão Social da Clínica",
      "clinic"
    ),
    CLINICA_CNPJ: requireField(
      clinic.cnpj,
      "cnpj",
      "CNPJ da Clínica",
      "clinic"
    ),
    CLINICA_ENDERECO: requireField(
      clinic.address,
      "address",
      "Endereço da Clínica",
      "clinic"
    ),
    CLINICA_RESPONSAVEL: requireField(
      clinicRep,
      "legalRepName",
      "Representante Legal da Clínica",
      "clinic"
    ),
    CLINICA_CPF_RESPONSAVEL: requireField(
      clinic.legalRepCpf,
      "legalRepCpf",
      "CPF do Representante da Clínica",
      "clinic"
    ),
    CLINICA_SUBDOMINIO: requireField(
      subdomainFormatted,
      "subdomain",
      "Subdomínio Dedicado da Clínica",
      "clinic"
    ),
    DIA_VENCIMENTO: String(clinic.dueDay).padStart(2, "0"),
    DIAS_SUSPENSAO: String(settings.defaultSuspensionDays || 15),
    MESES_FIDELIDADE: String(fidelityMonths),
    PERCENTUAL_MULTA_FIDELIDADE: String(settings.defaultFidelityPenaltyPct ?? 30),
    CANAL_SUPORTE: settings.supportChannel?.trim() || "WhatsApp",
    HORARIO_SUPORTE:
      settings.supportHours?.trim() || "Segunda a sexta, das 08h às 18h",
    FORO_CONTRATO: settings.contractCourt?.trim() || "Contagem/MG",
    DATA_CONTRATO: formatDateLongBR(effectiveStartDate),
    FAIXA_PLANO: PLAN_TIER_LABELS[clinic.planTier].label,
    LIMITE_MEDICOS: getTierDoctorRangeText(clinic.planTier),
    IS_FOUNDER_LABEL: clinic.isFounder
      ? "Sim (condição especial aplicada)"
      : "Não",
    VALOR_MENSAL_FORMATADO: formatBRL(clinic.monthlyFeeCents),
    VALOR_SETUP_FORMATADO: formatBRL(clinic.setupFeeCents),
    PARCELAMENTO_SETUP: formatSetupInstallmentsLabel(
      clinic.setupFeeCents,
      clinic.setupInstallments
    ),
    DATA_INICIO: formatDateBR(effectiveStartDate),
    DATA_FIM_FIDELIDADE: fidelityEndDate
      ? formatDateBR(fidelityEndDate)
      : PLACEHOLDER_TAG,
    INFRA_DESCRICAO: INFRA_TYPE_LABELS[clinic.infraType],
  };

  return { variables, missingFields };
}
