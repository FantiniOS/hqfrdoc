"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClinicStatus, InfraType, PlanTier } from "@prisma/client";
import { Building2, FileText, Loader2, Sparkles, X } from "lucide-react";
import {
  CONTRACT_STATUS_META,
  CONTRACT_STATUS_OPTIONS,
  formatSetupInstallmentsLabel,
  getFidelityEndDate,
  getTierDoctorRangeText,
  normalizeContractStatus,
  type ContractStatusValue,
} from "@/lib/contract";
import {
  addOneYearUTC,
  centsToReaisString,
  dateToInputYMD,
  formatBRL,
  formatDateBR,
  getTodaySaoPaulo,
  parseBRLToCents,
  parseDateInputToUTC,
} from "@/lib/format";
import {
  calculateOfficialPricing,
  CLINIC_STATUS_META,
  INFRA_TYPE_LABELS,
  PLAN_TIER_LABELS,
} from "@/lib/pricing";

export interface ClinicRecord {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  address: string | null;
  responsibleName: string;
  legalRepName: string | null;
  legalRepCpf: string | null;
  whatsapp: string;
  email: string | null;
  subdomain: string | null;
  status: ClinicStatus;
  activeDoctors: number;
  planTier: PlanTier;
  isFounder: boolean;
  setupFeeCents: number;
  setupInstallments: number | null;
  monthlyFeeCents: number;
  dueDay: number;
  startDate: string;
  nextAdjustmentDate: string | null;
  contractStartDate: string | null;
  fidelityMonths: number | null;
  contractStatus: string;
  infraType: InfraType;
  infraCostCents: number;
  technicalNotes: string | null;
}

const STATUS_OPTIONS: ClinicStatus[] = [
  "ACTIVE",
  "ONBOARDING",
  "DELINQUENT",
  "PAUSED",
  "CANCELED",
];

const TIER_OPTIONS: PlanTier[] = ["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"];

const INFRA_OPTIONS: InfraType[] = [
  "ORACLE_ALWAYS_FREE",
  "ORACLE_DEDICATED_VM",
  "PAID_DEDICATED_DB",
];

type ModalTab = "general" | "contract";

export function ClinicModal({
  open,
  clinic,
  defaultFidelityMonths = 12,
  onClose,
  onSaved,
}: {
  open: boolean;
  clinic: ClinicRecord | null;
  defaultFidelityMonths?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(clinic);

  const [activeTab, setActiveTab] = useState<ModalTab>("general");

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [status, setStatus] = useState<ClinicStatus>("ACTIVE");

  const [activeDoctors, setActiveDoctors] = useState(1);
  const [planTier, setPlanTier] = useState<PlanTier>("SMALL");
  const [isFounder, setIsFounder] = useState(false);
  const [setupInput, setSetupInput] = useState("1800,00");
  const [setupInstallments, setSetupInstallments] = useState<string>("1");
  const [monthlyInput, setMonthlyInput] = useState("790,00");
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [dueDay, setDueDay] = useState(10);
  const [startDate, setStartDate] = useState(getTodaySaoPaulo().ymd);
  const [nextAdjustmentDate, setNextAdjustmentDate] = useState("");

  // Campos Jurídicos & Contrato
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [legalRepName, setLegalRepName] = useState("");
  const [legalRepCpf, setLegalRepCpf] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [fidelityMonthsInput, setFidelityMonthsInput] = useState("");
  const [contractStatus, setContractStatus] = useState<ContractStatusValue>("DRAFT");

  const [infraType, setInfraType] = useState<InfraType>("ORACLE_ALWAYS_FREE");
  const [infraCostInput, setInfraCostInput] = useState("0,00");
  const [technicalNotes, setTechnicalNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const officialPricing = useMemo(
    () => calculateOfficialPricing(activeDoctors),
    [activeDoctors]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setActiveTab("general");

    if (clinic) {
      setName(clinic.name);
      setLegalName(clinic.legalName ?? "");
      setCnpj(clinic.cnpj ?? "");
      setAddress(clinic.address ?? "");
      setResponsibleName(clinic.responsibleName);
      setLegalRepName(clinic.legalRepName ?? "");
      setLegalRepCpf(clinic.legalRepCpf ?? "");
      setWhatsapp(clinic.whatsapp);
      setEmail(clinic.email ?? "");
      setSubdomain(clinic.subdomain ?? "");
      setStatus(clinic.status);
      setActiveDoctors(clinic.activeDoctors);
      setPlanTier(clinic.planTier);
      setIsFounder(clinic.isFounder);
      setSetupInput(centsToReaisString(clinic.setupFeeCents));
      setSetupInstallments(String(clinic.setupInstallments ?? 1));
      setMonthlyInput(centsToReaisString(clinic.monthlyFeeCents));
      setManualPriceOverride(true);
      setDueDay(clinic.dueDay);
      setStartDate(dateToInputYMD(clinic.startDate));
      setNextAdjustmentDate(dateToInputYMD(clinic.nextAdjustmentDate));
      setContractStartDate(dateToInputYMD(clinic.contractStartDate));
      setFidelityMonthsInput(
        clinic.fidelityMonths ? String(clinic.fidelityMonths) : ""
      );
      setContractStatus(normalizeContractStatus(clinic.contractStatus));
      setInfraType(clinic.infraType);
      setInfraCostInput(centsToReaisString(clinic.infraCostCents));
      setTechnicalNotes(clinic.technicalNotes ?? "");
    } else {
      const todayYmd = getTodaySaoPaulo().ymd;
      const nextYearYmd = dateToInputYMD(addOneYearUTC(parseDateInputToUTC(todayYmd)));
      const initial = calculateOfficialPricing(1);

      setName("");
      setLegalName("");
      setCnpj("");
      setAddress("");
      setResponsibleName("");
      setLegalRepName("");
      setLegalRepCpf("");
      setWhatsapp("");
      setEmail("");
      setSubdomain("");
      setStatus("ACTIVE");
      setActiveDoctors(1);
      setPlanTier(initial.tier);
      setIsFounder(false);
      setSetupInput(centsToReaisString(initial.setupFeeCents));
      setSetupInstallments("1");
      setMonthlyInput(centsToReaisString(initial.monthlyFeeCents));
      setManualPriceOverride(false);
      setDueDay(10);
      setStartDate(todayYmd);
      setNextAdjustmentDate(nextYearYmd);
      setContractStartDate("");
      setFidelityMonthsInput("");
      setContractStatus("DRAFT");
      setInfraType("ORACLE_ALWAYS_FREE");
      setInfraCostInput("0,00");
      setTechnicalNotes("");
    }
  }, [open, clinic]);

  const effectiveFidelityMonths = useMemo(() => {
    const parsed = Number.parseInt(fidelityMonthsInput, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultFidelityMonths;
  }, [fidelityMonthsInput, defaultFidelityMonths]);

  const fidelityEndPreview = useMemo(() => {
    if (!contractStartDate) return null;
    const end = getFidelityEndDate(
      parseDateInputToUTC(contractStartDate),
      effectiveFidelityMonths
    );
    return end ? formatDateBR(end) : null;
  }, [contractStartDate, effectiveFidelityMonths]);

  if (!open) return null;

  function handleDoctorsChange(nextValue: number) {
    const safeDoctors = Math.max(1, Math.min(500, Math.trunc(nextValue || 1)));
    setActiveDoctors(safeDoctors);

    if (!manualPriceOverride && !isFounder) {
      const suggestion = calculateOfficialPricing(safeDoctors);
      setPlanTier(suggestion.tier);
      setSetupInput(centsToReaisString(suggestion.setupFeeCents));
      setMonthlyInput(centsToReaisString(suggestion.monthlyFeeCents));
    }
  }

  function applyOfficialTable() {
    setPlanTier(officialPricing.tier);
    setSetupInput(centsToReaisString(officialPricing.setupFeeCents));
    setMonthlyInput(centsToReaisString(officialPricing.monthlyFeeCents));
    setManualPriceOverride(false);
  }

  function handleStartDateChange(nextStart: string) {
    setStartDate(nextStart);
    if (!isEditing && nextStart.length === 10) {
      const nextYear = dateToInputYMD(addOneYearUTC(parseDateInputToUTC(nextStart)));
      setNextAdjustmentDate(nextYear);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parsedFidelity = fidelityMonthsInput.trim()
      ? Number.parseInt(fidelityMonthsInput.trim(), 10)
      : null;
    const parsedInstallments = setupInstallments.trim()
      ? Number.parseInt(setupInstallments.trim(), 10)
      : null;

    const payload = {
      name,
      legalName: legalName || null,
      cnpj: cnpj || null,
      address: address || null,
      responsibleName,
      legalRepName: legalRepName || null,
      legalRepCpf: legalRepCpf || null,
      whatsapp,
      email: email || null,
      subdomain: subdomain || null,
      status,
      activeDoctors,
      planTier,
      isFounder,
      setupFeeCents: parseBRLToCents(setupInput),
      setupInstallments:
        parsedInstallments && parsedInstallments > 0 ? parsedInstallments : null,
      monthlyFeeCents: parseBRLToCents(monthlyInput),
      dueDay,
      startDate,
      nextAdjustmentDate: nextAdjustmentDate || null,
      contractStartDate: contractStartDate || null,
      fidelityMonths:
        parsedFidelity && parsedFidelity > 0 ? parsedFidelity : null,
      contractStatus,
      infraType,
      infraCostCents: parseBRLToCents(infraCostInput),
      technicalNotes: technicalNotes || null,
    };

    try {
      const res = await fetch(
        clinic ? `/api/clinics/${clinic.id}` : "/api/clinics",
        {
          method: clinic ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar clínica.");
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Falha de comunicação com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  const setupCentsCurrent = parseBRLToCents(setupInput);
  const monthlyCentsCurrent = parseBRLToCents(monthlyInput);
  const differsFromOfficial =
    setupCentsCurrent !== officialPricing.setupFeeCents ||
    monthlyCentsCurrent !== officialPricing.monthlyFeeCents ||
    planTier !== officialPricing.tier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? "Editar Clínica" : "Nova Clínica Cliente"}
              </h2>
              <p className="text-xs text-slate-600">
                Precificação oficial FRdoc 2.0, infraestrutura e dados contratuais
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Abas do Modal */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-2.5">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "general"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Cadastro, Plano & Infra
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contract")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "contract"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Dados Jurídicos & Contrato
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[76vh] space-y-5 overflow-y-auto px-6 py-5"
        >
          {activeTab === "general" ? (
            <>
              {/* Seção 1: Dados da Clínica */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  1. Dados da Clínica
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Nome Fantasia / Clínica *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: Clínica Endocardio Paulista"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Médico / Responsável *
                    </label>
                    <input
                      type="text"
                      required
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Ex.: Dr. Rafael Mendes"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      WhatsApp *
                    </label>
                    <input
                      type="text"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="financeiro@clinica.com.br"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Subdomínio FRdoc
                    </label>
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="clinica.frdoc.com.br"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ClinicStatus)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {CLINIC_STATUS_META[st].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Plano e Cobrança */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    2. Plano e Cobrança (Tabela FRdoc 2.0)
                  </h3>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={isFounder}
                      onChange={(e) => setIsFounder(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-600"
                    />
                    Clínica Fundadora
                  </label>
                </div>

                {/* Banner inteligente da Tabela Oficial */}
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <div>
                      <span className="font-semibold text-emerald-900">
                        Sugestão Oficial ({officialPricing.tierLabel}):
                      </span>{" "}
                      <span className="font-medium text-emerald-800">
                        Setup {formatBRL(officialPricing.setupFeeCents)} · Mensalidade{" "}
                        {formatBRL(officialPricing.monthlyFeeCents)}
                      </span>
                      <p className="text-[11px] text-emerald-700/90">
                        {officialPricing.formulaSummary}
                      </p>
                    </div>
                  </div>
                  {differsFromOfficial && (
                    <button
                      type="button"
                      onClick={applyOfficialTable}
                      className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Aplicar tabela oficial
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Médicos Ativos *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      required
                      value={activeDoctors}
                      onChange={(e) => handleDoctorsChange(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Faixa do Plano
                    </label>
                    <select
                      value={planTier}
                      onChange={(e) => {
                        setPlanTier(e.target.value as PlanTier);
                        setManualPriceOverride(true);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {TIER_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {PLAN_TIER_LABELS[t].label} ({PLAN_TIER_LABELS[t].range})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Dia de Vencimento (1–28) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      required
                      value={dueDay}
                      onChange={(e) => setDueDay(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Setup Negociado (R$)
                    </label>
                    <input
                      type="text"
                      required
                      value={setupInput}
                      onChange={(e) => {
                        setSetupInput(e.target.value);
                        setManualPriceOverride(true);
                      }}
                      placeholder="1800,00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Mensalidade Contratada (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={monthlyInput}
                      onChange={(e) => {
                        setMonthlyInput(e.target.value);
                        setManualPriceOverride(true);
                      }}
                      placeholder="790,00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm font-semibold text-emerald-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Data de Início *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Próximo Reajuste Anual (IPCA)
                    </label>
                    <input
                      type="date"
                      value={nextAdjustmentDate}
                      onChange={(e) => setNextAdjustmentDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:max-w-[220px]"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Controle de Infraestrutura */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  3. Controle de Infraestrutura
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Tipo de Banco / Nuvem
                    </label>
                    <select
                      value={infraType}
                      onChange={(e) => {
                        const nextType = e.target.value as InfraType;
                        setInfraType(nextType);
                        if (nextType === "ORACLE_ALWAYS_FREE" && !isEditing) {
                          setInfraCostInput("0,00");
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {INFRA_OPTIONS.map((inf) => (
                        <option key={inf} value={inf}>
                          {INFRA_TYPE_LABELS[inf]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Custo Mensal Real de Nuvem (R$)
                    </label>
                    <input
                      type="text"
                      value={infraCostInput}
                      onChange={(e) => setInfraCostInput(e.target.value)}
                      placeholder="0,00 ou 180,00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Observações Técnicas (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={technicalNotes}
                      onChange={(e) => setTechnicalNotes(e.target.value)}
                      placeholder="Ex.: Instância Oracle SA-SP #1, backup diário S3, domínio apontado via Cloudflare..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Aba 2: Dados Jurídicos & Contrato */
            <div className="space-y-4">
              {/* Resumo comercial sincronizado com pricing.ts / aba 1 */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs">
                <p className="font-semibold text-emerald-900">
                  Resumo Comercial Sincronizado (Anexo I do Contrato)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-emerald-900 sm:grid-cols-4">
                  <div>
                    <span className="block text-[10px] font-medium text-emerald-700 uppercase">
                      Faixa / Porte
                    </span>
                    <strong className="font-semibold">
                      {PLAN_TIER_LABELS[planTier].label} ({getTierDoctorRangeText(planTier)})
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-medium text-emerald-700 uppercase">
                      Mensalidade
                    </span>
                    <strong className="font-mono-num font-semibold">
                      {formatBRL(monthlyCentsCurrent)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-medium text-emerald-700 uppercase">
                      Setup
                    </span>
                    <strong className="font-mono-num font-semibold">
                      {formatBRL(setupCentsCurrent)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-medium text-emerald-700 uppercase">
                      Parcelamento Setup
                    </span>
                    <strong className="font-semibold">
                      {formatSetupInstallmentsLabel(
                        setupCentsCurrent,
                        Number.parseInt(setupInstallments, 10) || 1
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Qualificação Jurídica da Contratante */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Qualificação Jurídica da Contratante
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Razão Social Completa
                    </label>
                    <input
                      type="text"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      placeholder="Ex.: Clínica Médica Endocardio Paulista Ltda"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      CNPJ da Clínica
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Status do Contrato
                    </label>
                    <select
                      value={contractStatus}
                      onChange={(e) =>
                        setContractStatus(e.target.value as ContractStatusValue)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {CONTRACT_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {CONTRACT_STATUS_META[st].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Endereço Completo da Sede
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Av./Rua, nº, sala, bairro, cidade/UF, CEP"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Representante Legal (Assinante)
                    </label>
                    <input
                      type="text"
                      value={legalRepName}
                      onChange={(e) => setLegalRepName(e.target.value)}
                      placeholder={
                        responsibleName
                          ? `Padrão: ${responsibleName}`
                          : "Nome completo do representante legal"
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      CPF do Representante Legal
                    </label>
                    <input
                      type="text"
                      value={legalRepCpf}
                      onChange={(e) => setLegalRepCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Condições Contratuais Específicas */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Vigência, Fidelidade e Parcelamento do Setup
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Data de Início do Contrato
                    </label>
                    <input
                      type="date"
                      value={contractStartDate}
                      onChange={(e) => setContractStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {fidelityEndPreview && (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700">
                        Fidelidade até {fidelityEndPreview}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Fidelidade (meses)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={fidelityMonthsInput}
                      onChange={(e) => setFidelityMonthsInput(e.target.value)}
                      placeholder={`Padrão: ${defaultFidelityMonths} meses`}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Parcelamento do Setup
                    </label>
                    <select
                      value={setupInstallments}
                      onChange={(e) => setSetupInstallments(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="1">1x (À vista)</option>
                      <option value="2">2x mensais</option>
                      <option value="3">3x mensais</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Setup no Contrato (R$)
                    </label>
                    <input
                      type="text"
                      value={setupInput}
                      onChange={(e) => {
                        setSetupInput(e.target.value);
                        setManualPriceOverride(true);
                      }}
                      placeholder="1800,00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Cadastrar Clínica"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
