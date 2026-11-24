"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClinicStatus, InfraType, PlanTier } from "@prisma/client";
import { Building2, Loader2, Sparkles, X } from "lucide-react";
import {
  addOneYearUTC,
  centsToReaisString,
  dateToInputYMD,
  formatBRL,
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
  cnpj: string | null;
  responsibleName: string;
  whatsapp: string;
  email: string | null;
  subdomain: string | null;
  status: ClinicStatus;
  activeDoctors: number;
  planTier: PlanTier;
  isFounder: boolean;
  setupFeeCents: number;
  monthlyFeeCents: number;
  dueDay: number;
  startDate: string;
  nextAdjustmentDate: string | null;
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

export function ClinicModal({
  open,
  clinic,
  onClose,
  onSaved,
}: {
  open: boolean;
  clinic: ClinicRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(clinic);

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
  const [monthlyInput, setMonthlyInput] = useState("790,00");
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [dueDay, setDueDay] = useState(10);
  const [startDate, setStartDate] = useState(getTodaySaoPaulo().ymd);
  const [nextAdjustmentDate, setNextAdjustmentDate] = useState("");

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

    if (clinic) {
      setName(clinic.name);
      setCnpj(clinic.cnpj ?? "");
      setResponsibleName(clinic.responsibleName);
      setWhatsapp(clinic.whatsapp);
      setEmail(clinic.email ?? "");
      setSubdomain(clinic.subdomain ?? "");
      setStatus(clinic.status);
      setActiveDoctors(clinic.activeDoctors);
      setPlanTier(clinic.planTier);
      setIsFounder(clinic.isFounder);
      setSetupInput(centsToReaisString(clinic.setupFeeCents));
      setMonthlyInput(centsToReaisString(clinic.monthlyFeeCents));
      setManualPriceOverride(true);
      setDueDay(clinic.dueDay);
      setStartDate(dateToInputYMD(clinic.startDate));
      setNextAdjustmentDate(dateToInputYMD(clinic.nextAdjustmentDate));
      setInfraType(clinic.infraType);
      setInfraCostInput(centsToReaisString(clinic.infraCostCents));
      setTechnicalNotes(clinic.technicalNotes ?? "");
    } else {
      const todayYmd = getTodaySaoPaulo().ymd;
      const nextYearYmd = dateToInputYMD(addOneYearUTC(parseDateInputToUTC(todayYmd)));
      const initial = calculateOfficialPricing(1);

      setName("");
      setCnpj("");
      setResponsibleName("");
      setWhatsapp("");
      setEmail("");
      setSubdomain("");
      setStatus("ACTIVE");
      setActiveDoctors(1);
      setPlanTier(initial.tier);
      setIsFounder(false);
      setSetupInput(centsToReaisString(initial.setupFeeCents));
      setMonthlyInput(centsToReaisString(initial.monthlyFeeCents));
      setManualPriceOverride(false);
      setDueDay(10);
      setStartDate(todayYmd);
      setNextAdjustmentDate(nextYearYmd);
      setInfraType("ORACLE_ALWAYS_FREE");
      setInfraCostInput("0,00");
      setTechnicalNotes("");
    }
  }, [open, clinic]);

  if (!open) return null;

  function handleDoctorsChange(nextValue: number) {
    const safeDoctors = Math.max(1, Math.min(500, Math.trunc(nextValue || 1)));
    setActiveDoctors(safeDoctors);

    // Atualiza faixa e valores automaticamente enquanto não houver sobrescrita manual/fundadora
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

    const payload = {
      name,
      cnpj: cnpj || null,
      responsibleName,
      whatsapp,
      email: email || null,
      subdomain: subdomain || null,
      status,
      activeDoctors,
      planTier,
      isFounder,
      setupFeeCents: parseBRLToCents(setupInput),
      monthlyFeeCents: parseBRLToCents(monthlyInput),
      dueDay,
      startDate,
      nextAdjustmentDate: nextAdjustmentDate || null,
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

  const differsFromOfficial =
    parseBRLToCents(setupInput) !== officialPricing.setupFeeCents ||
    parseBRLToCents(monthlyInput) !== officialPricing.monthlyFeeCents ||
    planTier !== officialPricing.tier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0f1623] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isEditing ? "Editar Clínica" : "Nova Clínica Cliente"}
              </h2>
              <p className="text-xs text-slate-400">
                Precificação oficial FRdoc 2.0 com suporte a negociação manual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Seção 1: Dados da Clínica */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              1. Dados da Clínica
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Nome da Clínica *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Clínica Endocardio Paulista"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Médico / Responsável *
                </label>
                <input
                  type="text"
                  required
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="Ex.: Dr. Rafael Mendes"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="financeiro@clinica.com.br"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Subdomínio FRdoc
                </label>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="clinica.frdoc.com.br"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClinicStatus)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
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
          <div className="space-y-3 border-t border-slate-800/80 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                2. Plano e Cobrança (Tabela FRdoc 2.0)
              </h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                <input
                  type="checkbox"
                  checked={isFounder}
                  onChange={(e) => setIsFounder(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Clínica Fundadora
              </label>
            </div>

            {/* Banner inteligente da Tabela Oficial */}
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-semibold text-emerald-300">
                    Sugestão Oficial ({officialPricing.tierLabel}):
                  </span>{" "}
                  <span className="text-slate-300">
                    Setup {formatBRL(officialPricing.setupFeeCents)} · Mensalidade{" "}
                    {formatBRL(officialPricing.monthlyFeeCents)}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {officialPricing.formulaSummary}
                  </p>
                </div>
              </div>
              {differsFromOfficial && (
                <button
                  type="button"
                  onClick={applyOfficialTable}
                  className="shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  Aplicar tabela oficial
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Médicos Ativos *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={activeDoctors}
                  onChange={(e) => handleDoctorsChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Faixa do Plano
                </label>
                <select
                  value={planTier}
                  onChange={(e) => {
                    setPlanTier(e.target.value as PlanTier);
                    setManualPriceOverride(true);
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {PLAN_TIER_LABELS[t].label} ({PLAN_TIER_LABELS[t].range})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Dia de Vencimento (1–28) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  required
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
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
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
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
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-emerald-300 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Data de Início *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Próximo Reajuste Anual (IPCA)
                </label>
                <input
                  type="date"
                  value={nextAdjustmentDate}
                  onChange={(e) => setNextAdjustmentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60 sm:max-w-[220px]"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Controle de Infraestrutura */}
          <div className="space-y-3 border-t border-slate-800/80 pt-4">
            <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              3. Controle de Infraestrutura
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
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
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                >
                  {INFRA_OPTIONS.map((inf) => (
                    <option key={inf} value={inf}>
                      {INFRA_TYPE_LABELS[inf]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Custo Mensal Real de Nuvem (R$)
                </label>
                <input
                  type="text"
                  value={infraCostInput}
                  onChange={(e) => setInfraCostInput(e.target.value)}
                  placeholder="0,00 ou 180,00"
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-white outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Observações Técnicas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  placeholder="Ex.: Instância Oracle SA-SP #1, backup diário S3, domínio apontado via Cloudflare..."
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
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
