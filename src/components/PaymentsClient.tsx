"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoiceStatus, InvoiceType, PaymentMethod } from "@prisma/client";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Plus,
  Receipt,
  RotateCcw,
  Sparkles,
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
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type InvoiceDisplayStatus,
} from "@/lib/pricing";
import { buildWhatsAppChargeUrl } from "@/lib/whatsapp";

interface InvoiceRow {
  id: string;
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
  installmentNumber: number | null;
  installmentTotal: number | null;
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
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function handleGenerateMonthly() {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competence }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: body.error ?? "Erro ao gerar mensalidades.",
        });
      } else {
        setFeedback({
          type: "success",
          text: body.message ?? "Mensalidades processadas.",
        });
        await loadInvoices(competence, statusFilter);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Falha de comunicação ao gerar mensalidades.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleReopen(invoice: InvoiceRow) {
    if (!window.confirm(`Estornar o pagamento de "${invoice.clinic.name}"?`)) return;
    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Fatura reaberta com sucesso." });
        await loadInvoices(competence, statusFilter);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(invoice: InvoiceRow) {
    if (
      !window.confirm(
        `Excluir a fatura "${invoice.description}" de "${invoice.clinic.name}"?`
      )
    ) {
      return;
    }
    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Fatura excluída." });
        await loadInvoices(competence, statusFilter);
      }
    } finally {
      setBusyId(null);
    }
  }

  const summary = data?.summary;
  const counts = summary?.counts;

  const filterButtons: Array<{
    key: FilterKey;
    label: string;
    count: number;
    dot?: string;
  }> = [
    { key: "ALL", label: "Todas", count: counts?.all ?? 0 },
    {
      key: "PAID",
      label: "Pago",
      count: counts?.paid ?? 0,
      dot: "bg-emerald-500",
    },
    {
      key: "OPEN",
      label: "Em Aberto",
      count: counts?.open ?? 0,
      dot: "bg-sky-500",
    },
    {
      key: "DUE_SOON",
      label: "Vence em breve",
      count: counts?.dueSoon ?? 0,
      dot: "bg-amber-500",
    },
    {
      key: "OVERDUE",
      label: "Atrasado",
      count: counts?.overdue ?? 0,
      dot: "bg-rose-500",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Ações Principais */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Pagamentos & Faturas
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Mensalidades recorrentes, setups parcelados, serviços opcionais e cobrança via WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector competence={competence} onChange={setCompetence} />

          <button
            type="button"
            onClick={() => void handleGenerateMonthly()}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Gerar Mensalidades do Mês
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Lançamento Avulso
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-4 text-[11px] font-semibold opacity-75 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Resumo da Competência */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">
            Total Faturado
          </p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-slate-900">
            {summary ? formatBRL(summary.totalCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">
            Recebido
          </p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-emerald-600">
            {summary ? formatBRL(summary.paidCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">
            A Receber
          </p>
          <p className="mt-1 font-mono-num text-lg font-semibold text-sky-700">
            {summary ? formatBRL(summary.openCents) : "—"}
          </p>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 shadow-xs ${
            (summary?.overdueCents ?? 0) > 0
              ? "border-rose-200 bg-rose-50/70"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-[11px] font-semibold text-slate-500 uppercase">
            Em Atraso
          </p>
          <p
            className={`mt-1 font-mono-num text-lg font-semibold ${
              (summary?.overdueCents ?? 0) > 0 ? "text-rose-700" : "text-slate-700"
            }`}
          >
            {summary ? formatBRL(summary.overdueCents) : "—"}
          </p>
        </div>
      </div>

      {/* Filtros Semáforo */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        {filterButtons.map((btn) => {
          const active = statusFilter === btn.key;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={() => setStatusFilter(btn.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {btn.dot && <span className={`h-2 w-2 rounded-full ${btn.dot}`} />}
              <span>{btn.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono-num text-[10px] font-semibold ${
                  active
                    ? "bg-white text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabela de Faturas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="px-4 py-3">Clínica</th>
                <th className="px-4 py-3">Lançamento</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Semáforo / Pagamento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Carregando recebimentos...
                  </td>
                </tr>
              ) : !data || data.invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <Receipt className="mx-auto mb-2.5 h-8 w-8 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-800">
                      Nenhuma fatura nesta competência
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Clique em <strong>Gerar Mensalidades do Mês</strong> ou crie um{" "}
                      <strong>Lançamento Avulso</strong>.
                    </p>
                  </td>
                </tr>
              ) : (
                data.invoices.map((inv) => {
                  const statusMeta = computeInvoiceDisplayStatus(
                    inv.status,
                    inv.dueDate
                  );
                  const isPaid = inv.status === "PAID";
                  const isOverdue = statusMeta.displayStatus === "OVERDUE";

                  const waUrl = buildWhatsAppChargeUrl({
                    whatsapp: inv.clinic.whatsapp,
                    responsibleName: inv.clinic.responsibleName,
                    clinicName: inv.clinic.name,
                    description: inv.description,
                    amountCents: inv.amountCents,
                    dueDate: inv.dueDate,
                    pixKey: data.settings.pixKey,
                    pixKeyType: data.settings.pixKeyType,
                    pixHolderName: data.settings.pixHolderName,
                    companyName: data.settings.companyName,
                  });

                  return (
                    <tr
                      key={inv.id}
                      className={`transition hover:bg-slate-50/80 ${
                        isOverdue ? "bg-rose-50/40" : ""
                      }`}
                    >
                      {/* Clínica */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-900">
                          {inv.clinic.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {inv.clinic.responsibleName}
                        </p>
                      </td>

                      {/* Lançamento */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-medium text-slate-800">
                          {inv.description}
                        </p>
                        <span className="mt-1 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {INVOICE_TYPE_LABELS[inv.type]}
                        </span>
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-3.5 align-top font-mono-num text-xs font-medium text-slate-700">
                        {formatDateBR(inv.dueDate)}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`font-mono-num text-sm font-semibold ${
                            isPaid ? "text-emerald-700" : "text-slate-900"
                          }`}
                        >
                          {formatBRL(inv.amountCents)}
                        </span>
                      </td>

                      {/* Semáforo / Pagamento */}
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          {statusMeta.label}
                        </span>
                        {isPaid && (
                          <p className="mt-1 text-[11px] text-slate-600">
                            {inv.paidAt ? formatDateBR(inv.paidAt) : ""}
                            {inv.paymentMethod
                              ? ` · ${PAYMENT_METHOD_LABELS[inv.paymentMethod]}`
                              : ""}
                            {inv.receiptNote ? ` · ${inv.receiptNote}` : ""}
                          </p>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!isPaid ? (
                            <>
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
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Dar Baixa
                              </button>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                    isOverdue
                                      ? "border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  {isOverdue ? "Cobrar" : "Lembrar"}
                                </a>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleReopen(inv)}
                              disabled={busyId === inv.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                              Estornar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleDelete(inv)}
                            disabled={busyId === inv.id}
                            aria-label="Excluir fatura"
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
