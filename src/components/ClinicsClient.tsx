"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClinicStatus } from "@prisma/client";
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ClinicModal, type ClinicRecord } from "@/components/ClinicModal";
import { formatBRL, formatDateBR, getSubdomainUrl } from "@/lib/format";
import {
  CLINIC_STATUS_META,
  getTierCeilingAlert,
  INFRA_TYPE_LABELS,
  PLAN_TIER_LABELS,
} from "@/lib/pricing";

const STATUS_FILTERS: Array<{ value: "ALL" | ClinicStatus; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "ACTIVE", label: "Ativa" },
  { value: "ONBOARDING", label: "Implantação" },
  { value: "DELINQUENT", label: "Inadimplente" },
  { value: "PAUSED", label: "Pausada" },
  { value: "CANCELED", label: "Cancelada" },
];

export function ClinicsClient() {
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClinicStatus>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<ClinicRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(clinic: ClinicRecord) {
    const confirmed = window.confirm(
      `Remover "${clinic.name}" e todas as faturas associadas? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

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
    <div className="space-y-5">
      {/* Topo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Clínicas Clientes
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Carteira ativa, faixas FRdoc 2.0, reajustes IPCA e custo real de nuvem.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingClinic(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Nova Clínica
        </button>
      </div>

      {/* Resumo compacto */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800/80 bg-[#0f1623] px-4 py-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase">Total na Carteira</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-white">
            {metrics.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0f1623] px-4 py-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase">Clínicas Ativas</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-emerald-400">
            {metrics.activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0f1623] px-4 py-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase">MRR Contratado</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-white">
            {formatBRL(metrics.mrrCents)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0f1623] px-4 py-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase">Infra Mensal Total</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-amber-300">
            {formatBRL(metrics.infraCents)}
          </p>
        </div>
      </div>

      {/* Busca e Filtros de Status */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-[#0f1623] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clínica, médico, CNPJ ou subdomínio..."
            className="w-full rounded-xl border border-slate-800 bg-[#090d16] py-2 pr-3 pl-9 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-slate-800 text-white ring-1 ring-slate-700"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0f1623]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800/90 bg-[#0b111e] text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="px-4 py-3">Clínica / Subdomínio</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Plano & Médicos</th>
                <th className="px-4 py-3">Mensalidade</th>
                <th className="px-4 py-3">Infraestrutura</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Carregando carteira de clínicas...
                  </td>
                </tr>
              ) : filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Building2 className="mx-auto mb-2.5 h-8 w-8 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">
                      Nenhuma clínica encontrada
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Cadastre sua primeira clínica ou ajuste os filtros acima.
                    </p>
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

                  return (
                    <tr
                      key={clinic.id}
                      className="transition hover:bg-slate-800/25"
                    >
                      {/* Clínica & Subdomínio */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {clinic.name}
                          </span>
                          {clinic.isFounder && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              <Sparkles className="h-2.5 w-2.5" />
                              Fundadora
                            </span>
                          )}
                        </div>
                        {subdomainUrl && clinic.subdomain ? (
                          <a
                            href={subdomainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-sky-400 transition hover:text-sky-300"
                          >
                            <span>{clinic.subdomain}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Subdomínio não definido
                          </p>
                        )}
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="text-sm text-slate-200">
                          {clinic.responsibleName}
                        </p>
                        <p className="mt-0.5 font-mono-num text-xs text-slate-400">
                          {clinic.whatsapp}
                        </p>
                      </td>

                      {/* Plano & Médicos + Alerta de Teto */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-200">
                            {tierMeta.label}
                          </span>
                          <span className="font-mono-num text-xs text-slate-400">
                            {clinic.activeDoctors}{" "}
                            {clinic.activeDoctors === 1 ? "médico" : "médicos"}
                          </span>
                        </div>
                        {ceilingAlert.show && clinic.status !== "CANCELED" && (
                          <div
                            title={ceilingAlert.message}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>
                              Teto {ceilingAlert.ratioLabel} · Upgrade{" "}
                              {ceilingAlert.nextTierLabel}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Mensalidade */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-mono-num text-sm font-semibold text-emerald-400">
                          {formatBRL(clinic.monthlyFeeCents)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Venc. dia {String(clinic.dueDay).padStart(2, "0")}
                          {clinic.nextAdjustmentDate
                            ? ` · IPCA ${formatDateBR(clinic.nextAdjustmentDate)}`
                            : ""}
                        </p>
                      </td>

                      {/* Infraestrutura */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Server className="h-3.5 w-3.5 text-slate-500" />
                          <span>{INFRA_TYPE_LABELS[clinic.infraType]}</span>
                        </div>
                        <p
                          className={`mt-0.5 font-mono-num text-xs ${
                            clinic.infraCostCents === 0
                              ? "text-emerald-400/90"
                              : "text-amber-300"
                          }`}
                        >
                          {clinic.infraCostCents === 0
                            ? "R$ 0,00 (Always Free)"
                            : `${formatBRL(clinic.infraCostCents)}/mês`}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.badgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClinic(clinic);
                              setModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(clinic)}
                            disabled={deletingId === clinic.id}
                            aria-label={`Excluir ${clinic.name}`}
                            className="rounded-lg border border-slate-800 bg-[#090d16] p-1.5 text-slate-500 transition hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-50"
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
        open={modalOpen}
        clinic={editingClinic}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadClinics()}
      />
    </div>
  );
}
