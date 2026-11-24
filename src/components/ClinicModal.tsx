"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClinicStatus, InfraType, PlanTier } from "@prisma/client";
import { Check, Loader2, Search, UserCheck } from "lucide-react";
import { SlideOverDrawer } from "@/components/SlideOverDrawer";
import {
  getFidelityEndDate,
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

export interface LatestContractSummary {
  id: string;
  token: string;
  status: string;
  signedAt: string | null;
  startDate: string;
  endDate: string;
  documentHash: string;
}

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
  contracts?: LatestContractSummary[];
}

interface QsaPartner {
  name: string;
  role: string;
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

  const [cnpj, setCnpj] = useState("");
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [partners, setPartners] = useState<QsaPartner[]>([]);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [legalRepName, setLegalRepName] = useState("");
  const [legalRepCpf, setLegalRepCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [status, setStatus] = useState<ClinicStatus>("ACTIVE");

  const [activeDoctors, setActiveDoctors] = useState(1);
  const [planTier, setPlanTier] = useState<PlanTier>("SMALL");
  const [isFounder, setIsFounder] = useState(false);
  const [setupInput, setSetupInput] = useState("1800,00");
  const [setupInstallments, setSetupInstallments] = useState("1");
  const [monthlyInput, setMonthlyInput] = useState("790,00");
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [dueDay, setDueDay] = useState(10);
  const [startDate, setStartDate] = useState(getTodaySaoPaulo().ymd);
  const [nextAdjustmentDate, setNextAdjustmentDate] = useState("");
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
    setCnpjMessage(null);
    setPartners([]);

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
      setContractStartDate(todayYmd);
      setFidelityMonthsInput(String(defaultFidelityMonths));
      setContractStatus("DRAFT");
      setInfraType("ORACLE_ALWAYS_FREE");
      setInfraCostInput("0,00");
      setTechnicalNotes("");
    }
  }, [open, clinic, defaultFidelityMonths]);

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

  async function handleLookupCnpj() {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjMessage({
        type: "err",
        text: "Digite os 14 números do CNPJ para consultar.",
      });
      return;
    }

    setSearchingCnpj(true);
    setCnpjMessage(null);
    try {
      const res = await fetch(`/api/cnpj/${digits}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCnpjMessage({
          type: "err",
          text: data.error ?? "Não foi possível consultar o CNPJ.",
        });
        return;
      }

      setCnpj(data.cnpj || cnpj);
      if (data.legalName) setLegalName(data.legalName);
      if (data.tradeName && !name.trim()) setName(data.tradeName);
      else if (data.tradeName) setName(data.tradeName);
      if (data.address) setAddress(data.address);
      if (data.email && !email.trim()) setEmail(data.email);
      if (data.phone && !whatsapp.trim()) setWhatsapp(data.phone);

      const qsa: QsaPartner[] = Array.isArray(data.partners) ? data.partners : [];
      setPartners(qsa);

      if (qsa.length === 1 && qsa[0]) {
        if (!responsibleName.trim()) setResponsibleName(qsa[0].name);
        if (!legalRepName.trim()) setLegalRepName(qsa[0].name);
      }

      setCnpjMessage({
        type: "ok",
        text: `Dados preenchidos (${data.statusText || "Receita Federal"}).`,
      });
    } catch {
      setCnpjMessage({
        type: "err",
        text: "Erro de conexão ao buscar dados do CNPJ.",
      });
    } finally {
      setSearchingCnpj(false);
    }
  }

  function selectPartner(partnerName: string) {
    setLegalRepName(partnerName);
    if (!responsibleName.trim()) {
      setResponsibleName(partnerName);
    }
  }

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
      legalRepName: legalRepName || responsibleName || null,
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

  const differsFromOfficial =
    parseBRLToCents(setupInput) !== officialPricing.setupFeeCents ||
    parseBRLToCents(monthlyInput) !== officialPricing.monthlyFeeCents ||
    planTier !== officialPricing.tier;

  return (
    <SlideOverDrawer
      open={open}
      title={isEditing ? "Editar Clínica" : "Nova Clínica"}
      subtitle="Consulta automática na Receita Federal, precificação FRdoc 2.0 e infraestrutura."
      widthClass="max-w-xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="clinic-drawer-form"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Clínica"}
          </button>
        </div>
      }
    >
      <form id="clinic-drawer-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Topo: Consulta Pública de CNPJ */}
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <label className="mb-1.5 block text-xs font-semibold text-[#0F172A]">
            Consulta Rápida por CNPJ (Receita Federal)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
            />
            <button
              type="button"
              onClick={() => void handleLookupCnpj()}
              disabled={searchingCnpj}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {searchingCnpj ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Buscar
            </button>
          </div>

          {cnpjMessage && (
            <p
              className={`mt-2 text-xs ${
                cnpjMessage.type === "ok" ? "text-[#059669]" : "text-rose-600"
              }`}
            >
              {cnpjMessage.text}
            </p>
          )}

          {/* Lista de Sócios (QSA) para seleção rápida */}
          {partners.length > 0 && (
            <div className="mt-3 border-t border-[#E2E8F0] pt-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-[#64748B]">
                Quadro Societário (clique para selecionar o responsável legal):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {partners.map((p) => {
                  const selected = legalRepName === p.name;
                  return (
                    <button
                      key={`${p.name}-${p.role}`}
                      type="button"
                      onClick={() => selectPartner(p.name)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${
                        selected
                          ? "border-[#059669] bg-emerald-50 font-medium text-[#059669]"
                          : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-slate-50"
                      }`}
                    >
                      {selected ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <UserCheck className="h-3 w-3 text-[#64748B]" />
                      )}
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Seção 1: Identificação e Dados Jurídicos */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wider text-[#64748B] uppercase">
            Identificação & Representação Legal
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Nome Fantasia / Clínica *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Clínica Endocardio"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Status na Carteira
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClinicStatus)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {CLINIC_STATUS_META[st].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Razão Social (Contrato)
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Preenchido via CNPJ ou manualmente"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Endereço Completo da Sede
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, nº, bairro, cidade/UF, CEP"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Médico / Contato Principal *
              </label>
              <input
                type="text"
                required
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Dr. Rafael Mendes"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                WhatsApp *
              </label>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(31) 99999-9999"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Representante Legal (Contrato)
              </label>
              <input
                type="text"
                value={legalRepName}
                onChange={(e) => setLegalRepName(e.target.value)}
                placeholder="Nome completo do representante"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                CPF do Representante
              </label>
              <input
                type="text"
                value={legalRepCpf}
                onChange={(e) => setLegalRepCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@clinica.com.br"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Subdomínio Dedicado
              </label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="clinica.frdoc.com.br"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Plano FRdoc 2.0 & Contrato */}
        <div className="space-y-3 border-t border-[#E2E8F0] pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-[#64748B] uppercase">
              Plano FRdoc 2.0 & Fidelidade
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#0F172A]">
              <input
                type="checkbox"
                checked={isFounder}
                onChange={(e) => setIsFounder(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#059669]"
              />
              Clínica Fundadora
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs">
            <span className="text-[#64748B]">
              Tabela Oficial ({officialPricing.tierLabel}):{" "}
              <strong className="font-mono-num text-[#0F172A]">
                {formatBRL(officialPricing.monthlyFeeCents)}/mês
              </strong>{" "}
              + Setup {formatBRL(officialPricing.setupFeeCents)}
            </span>
            {differsFromOfficial && (
              <button
                type="button"
                onClick={applyOfficialTable}
                className="font-medium text-[#059669] hover:underline"
              >
                Restaurar tabela
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Médicos Ativos *
              </label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={activeDoctors}
                onChange={(e) => handleDoctorsChange(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Faixa
              </label>
              <select
                value={planTier}
                onChange={(e) => {
                  setPlanTier(e.target.value as PlanTier);
                  setManualPriceOverride(true);
                }}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {PLAN_TIER_LABELS[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Vencimento (1–28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                required
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Mensalidade (R$) *
              </label>
              <input
                type="text"
                required
                value={monthlyInput}
                onChange={(e) => {
                  setMonthlyInput(e.target.value);
                  setManualPriceOverride(true);
                }}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm font-semibold text-[#059669] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Setup (R$)
              </label>
              <input
                type="text"
                required
                value={setupInput}
                onChange={(e) => {
                  setSetupInput(e.target.value);
                  setManualPriceOverride(true);
                }}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Parcelas Setup
              </label>
              <select
                value={setupInstallments}
                onChange={(e) => setSetupInstallments(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              >
                <option value="1">À vista (1x)</option>
                <option value="2">2x mensais</option>
                <option value="3">3x mensais</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Início Contrato
              </label>
              <input
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Fidelidade (meses)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={fidelityMonthsInput}
                onChange={(e) => setFidelityMonthsInput(e.target.value)}
                placeholder={`${defaultFidelityMonths}`}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Próximo IPCA
              </label>
              <input
                type="date"
                value={nextAdjustmentDate}
                onChange={(e) => setNextAdjustmentDate(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>
          </div>

          {fidelityEndPreview && (
            <p className="text-[11px] text-[#64748B]">
              Término previsto da fidelidade:{" "}
              <strong className="font-mono-num text-[#0F172A]">
                {fidelityEndPreview}
              </strong>
            </p>
          )}
        </div>

        {/* Seção 3: Infraestrutura Dedicada */}
        <div className="space-y-3 border-t border-[#E2E8F0] pt-5">
          <h3 className="text-xs font-semibold tracking-wider text-[#64748B] uppercase">
            Infraestrutura Dedicada
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Ambiente Alocado
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
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              >
                {INFRA_OPTIONS.map((inf) => (
                  <option key={inf} value={inf}>
                    {INFRA_TYPE_LABELS[inf]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Custo Mensal de Nuvem (R$)
              </label>
              <input
                type="text"
                value={infraCostInput}
                onChange={(e) => setInfraCostInput(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Observações Técnicas
              </label>
              <input
                type="text"
                value={technicalNotes}
                onChange={(e) => setTechnicalNotes(e.target.value)}
                placeholder="IP da VM, região, observações de backup..."
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:border-[#059669]"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
      </form>
    </SlideOverDrawer>
  );
}
