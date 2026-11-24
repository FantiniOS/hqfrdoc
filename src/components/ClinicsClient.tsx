"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClinicStatus } from "@prisma/client";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ClinicModal, type ClinicRecord } from "@/components/ClinicModal";
import {
  CONTRACT_STATUS_META,
  getFidelityEndDate,
  normalizeContractStatus,
} from "@/lib/contract";
import { formatBRL, formatDateBR, getSubdomainUrl } from "@/lib/format";
import {
  CLINIC_STATUS_META,
  getTierCeilingAlert,
  INFRA_TYPE_LABELS,
  PLAN_TIER_LABELS,
} from "@/lib/pricing";

const STATUS_FILTERS: Array<{ value: "ALL" | ClinicStatus; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "ONBOARDING", label: "Implantação" },
  { value: "DELINQUENT", label: "Inadimplentes" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "CANCELED", label: "Canceladas" },
];

export function ClinicsClient() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [defaultFidelityMonths, setDefaultFidelityMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClinicStatus>("ALL");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<ClinicRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinics", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao listar clínicas.");
      }
      const json = await res.json();
      setClinics(json.clinics ?? []);
      if (typeof json.defaultFidelityMonths === "number") {
        setDefaultFidelityMonths(json.defaultFidelityMonths);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar clínicas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClinics();
  }, [loadClinics]);

  const filteredClinics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clinics.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.legalName ?? "").toLowerCase().includes(q) ||
        c.responsibleName.toLowerCase().includes(q) ||
        (c.subdomain ?? "").toLowerCase().includes(q) ||
        (c.cnpj ?? "").toLowerCase().includes(q)
      );
    });
  }, [clinics, search, statusFilter]);

  const metrics = useMemo(() => {
    const active = clinics.filter((c) => c.status === "ACTIVE");
    const mrrCents = active.reduce((s, c) => s + c.monthlyFeeCents, 0);
    const infraCents = clinics
      .filter((c) => c.status !== "CANCELED")
      .reduce((s, c) => s + c.infraCostCents, 0);
    return {
      total: clinics.length,
      activeCount: active.length,
      mrrCents,
      infraCents,
    };
  }, [clinics]);

  async function handleGenerateOrOpenContract(clinic: ClinicRecord) {
    const latest = clinic.contracts?.[0];
    if (latest) {
      router.push(`/clinics/${clinic.id}/contract`);
      return;
    }

    setGeneratingId(clinic.id);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: clinic.id }),
      });
      if (res.ok) {
        router.push(`/clinics/${clinic.id}/contract`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao gerar contrato.");
      }
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleCopySignUrl(token: string, contractId: string) {
    const url = `${window.location.origin}/assinar/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedContractId(contractId);
    setTimeout(() => setCopiedContractId(null), 2000);
  }

  async function handleDelete(clinic: ClinicRecord) {
    if (
      !window.confirm(
        `Remover "${clinic.name}" e todos os registros vinculados?`
      )
    ) {
      return;
    }
    setDeletingId(clinic.id);
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, { method: "DELETE" });
      if (res.ok) {
        await loadClinics();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao remover clínica.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#0F172A]">
            Clínicas
          </h1>
          <p className="text-xs text-[#64748B]">
            Carteira ativa, consulta Receita Federal, infraestrutura dedicada e contratos eletrônicos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingClinic(null);
            setDrawerOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Clínica
        </button>
      </div>

      {/* Resumo Minimalista */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Total na Carteira</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#0F172A]">
            {metrics.total}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Clínicas Ativas</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#059669]">
            {metrics.activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">MRR Contratado</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#0F172A]">
            {formatBRL(metrics.mrrCents)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Custo Infra Mensal</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#0F172A]">
            {formatBRL(metrics.infraCents)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Tabela Limpa */}
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, CNPJ, médico ou subdomínio..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-white py-1.5 pr-3 pl-8 text-xs text-[#0F172A] placeholder-slate-400 outline-none focus:border-[#059669]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-slate-100 text-[#0F172A]"
                      : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-medium text-[#64748B]">
                <th className="px-4 py-2.5">Clínica</th>
                <th className="px-4 py-2.5">Responsável</th>
                <th className="px-4 py-2.5">Plano & Mensalidade</th>
                <th className="px-4 py-2.5">Infraestrutura</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Contrato</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-[#64748B]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#059669]" />
                    Carregando clínicas...
                  </td>
                </tr>
              ) : filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-[#64748B]">
                    Nenhuma clínica encontrada.
                  </td>
                </tr>
              ) : (
                filteredClinics.map((clinic) => {
                  const statusMeta = CLINIC_STATUS_META[clinic.status];
                  const tierMeta = PLAN_TIER_LABELS[clinic.planTier];
                  const ceilingAlert = getTierCeilingAlert(
                    clinic.planTier,
                    clinic.activeDoctors
                  );
                  const subdomainUrl = getSubdomainUrl(clinic.subdomain);
                  const latestContract = clinic.contracts?.[0] ?? null;

                  const contractStatusKey = normalizeContractStatus(
                    latestContract?.status ?? clinic.contractStatus
                  );
                  const contractMeta = CONTRACT_STATUS_META[contractStatusKey];
                  const fidelityEnd = latestContract?.endDate
                    ? new Date(latestContract.endDate)
                    : getFidelityEndDate(
                        clinic.contractStartDate,
                        clinic.fidelityMonths ?? defaultFidelityMonths
                      );

                  return (
                    <tr key={clinic.id} className="transition hover:bg-slate-50/70">
                      {/* Clínica */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-[#0F172A]">
                            {clinic.name}
                          </span>
                          {clinic.isFounder && (
                            <span className="text-[10px] font-medium text-amber-700">
                              · Fundadora
                            </span>
                          )}
                        </div>
                        {subdomainUrl && clinic.subdomain ? (
                          <a
                            href={subdomainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#059669]"
                          >
                            <span>{clinic.subdomain}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <p className="mt-0.5 font-mono-num text-[11px] text-[#64748B]">
                            {clinic.cnpj || "Sem subdomínio"}
                          </p>
                        )}
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-3 align-middle">
                        <p className="text-xs font-medium text-[#0F172A]">
                          {clinic.responsibleName}
                        </p>
                        <p className="font-mono-num text-[11px] text-[#64748B]">
                          {clinic.whatsapp}
                        </p>
                      </td>

                      {/* Plano & Mensalidade */}
                      <td className="px-4 py-3 align-middle">
                        <p className="font-mono-num text-[13px] font-semibold text-[#0F172A]">
                          {formatBRL(clinic.monthlyFeeCents)}
                          <span className="font-sans text-[11px] font-normal text-[#64748B]">
                            /mês
                          </span>
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          {tierMeta.label} · {clinic.activeDoctors} méd.
                          {ceilingAlert.show && clinic.status !== "CANCELED" && (
                            <span className="ml-1 font-medium text-amber-700">
                              ({ceilingAlert.ratioLabel})
                            </span>
                          )}
                        </p>
                      </td>

                      {/* Infraestrutura */}
                      <td className="px-4 py-3 align-middle">
                        <p className="text-xs text-[#0F172A]">
                          {INFRA_TYPE_LABELS[clinic.infraType]}
                        </p>
                        <p className="font-mono-num text-[11px] text-[#64748B]">
                          {clinic.infraCostCents === 0
                            ? "R$ 0,00"
                            : `${formatBRL(clinic.infraCostCents)}/mês`}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          <span className="text-xs font-medium text-[#0F172A]">
                            {statusMeta.label}
                          </span>
                        </div>
                      </td>

                      {/* Contrato */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${contractMeta.dotClass}`}
                          />
                          <span className="text-xs font-medium text-[#0F172A]">
                            {latestContract ? contractMeta.label : "Não gerado"}
                          </span>
                        </div>
                        {fidelityEnd && (
                          <p className="mt-0.5 font-mono-num text-[11px] text-[#64748B]">
                            Fidelidade até {formatDateBR(fidelityEnd)}
                          </p>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {latestContract ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopySignUrl(
                                    latestContract.token,
                                    latestContract.id
                                  )
                                }
                                title="Copiar link de assinatura /assinar"
                                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
                              >
                                {copiedContractId === latestContract.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-[#059669]" />
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-[#64748B]" />
                                    Link
                                  </>
                                )}
                              </button>

                              <a
                                href={`/api/contracts/${latestContract.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir PDF nativo do contrato"
                                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
                              >
                                <Download className="h-3 w-3 text-[#64748B]" />
                                PDF
                              </a>

                              <Link
                                href={`/clinics/${clinic.id}/contract`}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#059669] transition hover:bg-emerald-50/50"
                              >
                                Detalhes
                              </Link>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleGenerateOrOpenContract(clinic)}
                              disabled={generatingId === clinic.id}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#059669] transition hover:bg-emerald-50/60 disabled:opacity-50"
                            >
                              {generatingId === clinic.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileSignature className="h-3 w-3" />
                              )}
                              Gerar Contrato
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingClinic(clinic);
                              setDrawerOpen(true);
                            }}
                            aria-label={`Editar ${clinic.name}`}
                            className="rounded-md border border-[#E2E8F0] bg-white p-1.5 text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(clinic)}
                            disabled={deletingId === clinic.id}
                            aria-label={`Remover ${clinic.name}`}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            {deletingId === clinic.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClinicModal
        open={drawerOpen}
        clinic={editingClinic}
        defaultFidelityMonths={defaultFidelityMonths}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void loadClinics()}
      />
    </div>
  );
}
