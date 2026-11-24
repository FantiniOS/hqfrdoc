"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoiceStatus, InvoiceType, PaymentMethod } from "@prisma/client";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  CreateInvoiceModal,
  type ClinicOption,
} from "@/components/CreateInvoiceModal";
import { MonthSelector } from "@/components/MonthSelector";
import {
  SettleInvoiceModal,
  type SettleTargetInvoice,
} from "@/components/SettleInvoiceModal";
import { formatBRL, formatDateBR, getTodaySaoPaulo } from "@/lib/format";
import {
  computeInvoiceDisplayStatus,
  PAYMENT_METHOD_LABELS,
  type InvoiceDisplayStatus,
} from "@/lib/pricing";
import { buildWhatsAppChargeUrl } from "@/lib/whatsapp";

interface InvoiceRow {
  id: string;
  publicToken: string;
  clinicId: string;
  type: InvoiceType;
  competence: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  receiptNote: string | null;
  displayStatus: InvoiceDisplayStatus;
  daysDiff: number;
  statusLabel: string;
  clinic: {
    id: string;
    name: string;
    responsibleName: string;
    whatsapp: string;
    status: string;
    subdomain: string | null;
  };
}

interface InvoicesApiResponse {
  competence: string;
  invoices: InvoiceRow[];
  summary: {
    totalCents: number;
    paidCents: number;
    openCents: number;
    overdueCents: number;
    counts: {
      all: number;
      paid: number;
      open: number;
      dueSoon: number;
      overdue: number;
    };
  };
  clinics: ClinicOption[];
  settings: {
    pixKey: string;
    pixKeyType: string;
    pixHolderName: string;
    companyName: string;
  };
}

type FilterKey = "ALL" | "PAID" | "OPEN" | "DUE_SOON" | "OVERDUE";

export function PaymentsClient() {
  const [competence, setCompetence] = useState(() => getTodaySaoPaulo().competence);
  const [statusFilter, setStatusFilter] = useState<FilterKey>("ALL");
  const [data, setData] = useState<InvoicesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<SettleTargetInvoice | null>(null);

  const loadInvoices = useCallback(async (comp: string, status: FilterKey) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ competence: comp });
      if (status !== "ALL") qs.set("status", status);

      const res = await fetch(`/api/invoices?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao carregar faturas.");
      }
      const json: InvoicesApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao carregar faturas.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices(competence, statusFilter);
  }, [competence, statusFilter, loadInvoices]);

  async function handleSyncMonth() {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competence }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: body.error ?? "Erro ao sincronizar." });
      } else {
        setFeedback({ type: "success", text: body.message ?? "Sincronizado." });
        await loadInvoices(competence, statusFilter);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function copyPublicLink(inv: InvoiceRow) {
    const url = `${window.location.origin}/fatura/${inv.publicToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleReopen(invoice: InvoiceRow) {
    if (!window.confirm(`Reabrir a fatura de "${invoice.clinic.name}"?`)) return;
    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      if (res.ok) {
        await loadInvoices(competence, statusFilter);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(invoice: InvoiceRow) {
    if (!window.confirm(`Excluir "${invoice.description}" de "${invoice.clinic.name}"?`)) {
      return;
    }
    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      if (res.ok) {
        await loadInvoices(competence, statusFilter);
      }
    } finally {
      setBusyId(null);
    }
  }

  const summary = data?.summary;
  const counts = summary?.counts;

  const tabs: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "ALL", label: "Todas", count: counts?.all ?? 0 },
    { key: "OPEN", label: "Em aberto", count: counts?.open ?? 0 },
    { key: "DUE_SOON", label: "Vence em breve", count: counts?.dueSoon ?? 0 },
    { key: "OVERDUE", label: "Atrasadas", count: counts?.overdue ?? 0 },
    { key: "PAID", label: "Pagas", count: counts?.paid ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#0F172A]">
            Financeiro
          </h1>
          <p className="text-xs text-[#64748B]">
            Recorrência automática ativa · Links de fatura com QR Code PIX nativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector competence={competence} onChange={setCompetence} />

          <button
            type="button"
            onClick={() => void handleSyncMonth()}
            disabled={syncing}
            title="Sincronizar mensalidades desta competência"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#64748B] ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Mês
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Cobrança
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50/70 text-[#059669]"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-4 text-[11px] font-medium opacity-75 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Faixa de Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Faturado no Mês</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#0F172A]">
            {summary ? formatBRL(summary.totalCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Recebido</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#059669]">
            {summary ? formatBRL(summary.paidCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Em Aberto</p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-[#0F172A]">
            {summary ? formatBRL(summary.openCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">Em Atraso</p>
          <p
            className={`mt-1 font-mono-num text-lg font-semibold ${
              (summary?.overdueCents ?? 0) > 0 ? "text-rose-600" : "text-[#0F172A]"
            }`}
          >
            {summary ? formatBRL(summary.overdueCents) : "—"}
          </p>
        </div>
      </div>

      {/* Tabela Executiva */}
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        {/* Abas de Filtro Internas */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E2E8F0] px-4 py-2.5">
          {tabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-slate-100 text-[#0F172A]"
                    : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono-num text-[11px] text-[#64748B]">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-medium text-[#64748B]">
                <th className="px-4 py-2.5">Clínica</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5">Vencimento</th>
                <th className="px-4 py-2.5">Valor</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#64748B]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#059669]" />
                    Carregando faturas...
                  </td>
                </tr>
              ) : !data || data.invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#64748B]">
                    Nenhuma cobrança registrada para este filtro.
                  </td>
                </tr>
              ) : (
                data.invoices.map((inv) => {
                  const statusMeta = computeInvoiceDisplayStatus(
                    inv.status,
                    inv.dueDate
                  );
                  const isPaid = inv.status === "PAID";
                  const origin =
                    typeof window !== "undefined" ? window.location.origin : "";
                  const invoiceUrl = origin
                    ? `${origin}/fatura/${inv.publicToken}`
                    : `/fatura/${inv.publicToken}`;

                  const waUrl = buildWhatsAppChargeUrl({
                    whatsapp: inv.clinic.whatsapp,
                    responsibleName: inv.clinic.responsibleName,
                    clinicName: inv.clinic.name,
                    description: inv.description,
                    amountCents: inv.amountCents,
                    dueDate: inv.dueDate,
                    invoiceUrl,
                    pixKey: data.settings.pixKey,
                    pixKeyType: data.settings.pixKeyType,
                    pixHolderName: data.settings.pixHolderName,
                    companyName: data.settings.companyName,
                  });

                  return (
                    <tr key={inv.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle">
                        <p className="text-[13px] font-medium text-[#0F172A]">
                          {inv.clinic.name}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          {inv.clinic.responsibleName}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-[#0F172A]">
                            {inv.description}
                          </span>
                          <a
                            href={`/fatura/${inv.publicToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir página pública da fatura"
                            className="text-[#64748B] hover:text-[#059669]"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle font-mono-num text-xs text-[#64748B]">
                        {formatDateBR(inv.dueDate)}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`font-mono-num text-[13px] font-semibold ${
                            isPaid ? "text-[#059669]" : "text-[#0F172A]"
                          }`}
                        >
                          {formatBRL(inv.amountCents)}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          <span className="text-xs font-medium text-[#0F172A]">
                            {statusMeta.label}
                          </span>
                        </div>
                        {isPaid && (
                          <p className="mt-0.5 text-[11px] text-[#64748B]">
                            {inv.paidAt ? formatDateBR(inv.paidAt) : ""}
                            {inv.paymentMethod
                              ? ` · ${PAYMENT_METHOD_LABELS[inv.paymentMethod]}`
                              : ""}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void copyPublicLink(inv)}
                            title="Copiar link público da fatura com PIX"
                            className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
                          >
                            {copiedId === inv.id ? (
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

                          {!isPaid ? (
                            <>
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
                                >
                                  <MessageCircle className="h-3 w-3 text-[#64748B]" />
                                  WhatsApp
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setSettleTarget({
                                    id: inv.id,
                                    clinicName: inv.clinic.name,
                                    description: inv.description,
                                    amountCents: inv.amountCents,
                                    dueDate: inv.dueDate,
                                  })
                                }
                                className="rounded-md bg-[#059669] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                              >
                                Dar Baixa
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleReopen(inv)}
                              disabled={busyId === inv.id}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A] disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Estornar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleDelete(inv)}
                            disabled={busyId === inv.id}
                            aria-label="Excluir fatura"
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            {busyId === inv.id ? (
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

      <CreateInvoiceModal
        open={createOpen}
        clinics={data?.clinics ?? []}
        defaultCompetence={competence}
        onClose={() => setCreateOpen(false)}
        onCreated={(msg) => {
          setFeedback({ type: "success", text: msg });
          void loadInvoices(competence, statusFilter);
        }}
      />

      <SettleInvoiceModal
        invoice={settleTarget}
        onClose={() => setSettleTarget(null)}
        onSettled={() => {
          setFeedback({ type: "success", text: "Baixa registrada com sucesso." });
          void loadInvoices(competence, statusFilter);
        }}
      />
    </div>
  );
}
