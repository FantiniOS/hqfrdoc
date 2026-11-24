"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { MonthSelector } from "@/components/MonthSelector";
import {
  RevenueProfitChart,
  type ChartPoint,
} from "@/components/RevenueProfitChart";
import {
  SettleInvoiceModal,
  type SettleTargetInvoice,
} from "@/components/SettleInvoiceModal";
import {
  formatBRL,
  formatDateBR,
  formatPercent,
  getTodaySaoPaulo,
} from "@/lib/format";
import { buildWhatsAppChargeUrl } from "@/lib/whatsapp";

interface QuickActionInvoice {
  id: string;
  publicToken: string;
  clinicId: string;
  clinicName: string;
  responsibleName: string;
  whatsapp: string;
  type: string;
  competence: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: string;
  displayStatus: "PAID" | "OPEN" | "DUE_SOON" | "OVERDUE" | "CANCELED";
  daysDiff: number;
  statusLabel: string;
}

interface DashboardResponse {
  competence: string;
  todayYmd: string;
  kpis: {
    mrrCents: number;
    activeClinicsCount: number;
    delinquentClinicsCount: number;
    totalClinicsCount: number;
    activeDoctorsTotal: number;
    receivedCents: number;
    receivedMonthlyCents: number;
    receivedExtrasCents: number;
    paidCount: number;
    receivableTotalCents: number;
    pendingMonthCents: number;
    openMonthCount: number;
    overdueCents: number;
    overdueCount: number;
    clinicInfraCents: number;
    fixedCostsCents: number;
    taxCents: number;
    taxRatePercent: number;
    taxRegimeLabel: string;
    totalCostsAndTaxesCents: number;
    netProfitCents: number;
    profitMarginPercent: number;
  };
  quickActionInvoices: QuickActionInvoice[];
  upgradeAlerts: Array<{
    clinicId: string;
    clinicName: string;
    activeDoctors: number;
    planTier: string;
    alert: {
      show: boolean;
      ratioLabel: string;
      message: string;
      nextTierLabel: string | null;
    };
  }>;
  chartSeries: ChartPoint[];
  settings: {
    taxRatePercent: number;
    taxRegimeLabel: string;
    pixKey: string;
    pixKeyType: string;
    pixHolderName: string;
    companyName: string;
  };
}

export function OverviewClient() {
  const [competence, setCompetence] = useState(() => getTodaySaoPaulo().competence);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<SettleTargetInvoice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDashboard = useCallback(async (comp: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?competence=${encodeURIComponent(comp)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Erro ao carregar indicadores.");
      }
      const json: DashboardResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(competence);
  }, [competence, loadDashboard]);

  async function copyInvoiceLink(inv: QuickActionInvoice) {
    const url = `${window.location.origin}/fatura/${inv.publicToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const kpis = data?.kpis;
  const hasOverdue = (kpis?.overdueCount ?? 0) > 0;
  const isProfitPositive = (kpis?.netProfitCents ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#0F172A]">
            Visão Geral
          </h1>
          <p className="text-xs text-[#64748B]">
            Receita recorrente, faturas com PIX nativo, custos e resultado líquido.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MonthSelector competence={competence} onChange={setCompetence} />
          <button
            type="button"
            onClick={() => void loadDashboard(competence)}
            disabled={loading}
            aria-label="Atualizar"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* 5 Indicadores Executivos Minimalistas */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">MRR Previsto</p>
          <p className="mt-2 font-mono-num text-xl font-semibold tracking-tight text-[#0F172A]">
            {kpis ? formatBRL(kpis.mrrCents) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {kpis
              ? `${kpis.activeClinicsCount} clínicas · ${kpis.activeDoctorsTotal} médicos`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">Recebido no Mês</p>
          <p className="mt-2 font-mono-num text-xl font-semibold tracking-tight text-[#059669]">
            {kpis ? formatBRL(kpis.receivedCents) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {kpis ? `${kpis.paidCount} fatura(s) paga(s)` : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">A Receber</p>
          <p
            className={`mt-2 font-mono-num text-xl font-semibold tracking-tight ${
              hasOverdue ? "text-rose-600" : "text-[#0F172A]"
            }`}
          >
            {kpis ? formatBRL(kpis.receivableTotalCents) : "—"}
          </p>
          <p
            className={`mt-1 text-[11px] ${
              hasOverdue ? "font-medium text-rose-600" : "text-[#64748B]"
            }`}
          >
            {kpis
              ? hasOverdue
                ? `${kpis.overdueCount} vencida(s) (${formatBRL(kpis.overdueCents)})`
                : `${kpis.openMonthCount} em aberto`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">Custos + Impostos</p>
          <p className="mt-2 font-mono-num text-xl font-semibold tracking-tight text-[#0F172A]">
            {kpis ? formatBRL(kpis.totalCostsAndTaxesCents) : "—"}
          </p>
          <p className="mt-1 truncate text-[11px] text-[#64748B]">
            {kpis
              ? `Op. ${formatBRL(kpis.clinicInfraCents + kpis.fixedCostsCents)} · Imp. ${formatPercent(kpis.taxRatePercent)}`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">Lucro Líquido</p>
            {kpis && (
              <span className="font-mono-num text-[11px] font-medium text-[#059669]">
                {formatPercent(kpis.profitMarginPercent)}
              </span>
            )}
          </div>
          <p
            className={`mt-2 font-mono-num text-xl font-semibold tracking-tight ${
              isProfitPositive ? "text-[#059669]" : "text-rose-600"
            }`}
          >
            {kpis ? formatBRL(kpis.netProfitCents) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">Resultado líquido em caixa</p>
        </div>
      </section>

      {/* Gráfico + Vencimentos Próximos */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Faturamento vs. Lucro (6 meses)
              </h2>
              <p className="text-xs text-[#64748B]">
                Histórico consolidado de caixa recebido, despesas e margem
              </p>
            </div>
          </div>

          {loading && !data ? (
            <div className="flex h-[290px] items-center justify-center text-xs text-[#64748B]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#059669]" />
              Carregando série...
            </div>
          ) : (
            <RevenueProfitChart data={data?.chartSeries ?? []} />
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Cobranças Próximas e Vencidas
              </h2>
              <p className="text-xs text-[#64748B]">
                Próximos 5 dias ou em atraso
              </p>
            </div>
            <Link
              href="/financeiro"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-[#059669] hover:underline"
            >
              Financeiro
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div
            className="flex-1 divide-y divide-[#E2E8F0] overflow-y-auto"
            style={{ maxHeight: "290px" }}
          >
            {loading && !data ? (
              <div className="flex h-44 items-center justify-center text-xs text-[#64748B]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : data && data.quickActionInvoices.length > 0 ? (
              data.quickActionInvoices.map((inv) => {
                const isOverdue = inv.daysDiff < 0;
                const origin =
                  typeof window !== "undefined" ? window.location.origin : "";
                const invoiceUrl = origin
                  ? `${origin}/fatura/${inv.publicToken}`
                  : `/fatura/${inv.publicToken}`;

                const waUrl = buildWhatsAppChargeUrl({
                  whatsapp: inv.whatsapp,
                  responsibleName: inv.responsibleName,
                  clinicName: inv.clinicName,
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
                  <div key={inv.id} className="py-3 first:pt-1 last:pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#0F172A]">
                          {inv.clinicName}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                          {inv.description} · Venc. {formatDateBR(inv.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono-num text-xs font-semibold text-[#0F172A]">
                          {formatBRL(inv.amountCents)}
                        </p>
                        <p
                          className={`text-[11px] ${
                            isOverdue ? "font-medium text-rose-600" : "text-amber-600"
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(inv.daysDiff)}d atraso`
                            : inv.daysDiff === 0
                              ? "Vence hoje"
                              : `Em ${inv.daysDiff}d`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSettleTarget({
                            id: inv.id,
                            clinicName: inv.clinicName,
                            description: inv.description,
                            amountCents: inv.amountCents,
                            dueDate: inv.dueDate,
                          })
                        }
                        className="rounded-md bg-[#059669] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700"
                      >
                        Dar Baixa
                      </button>

                      <button
                        type="button"
                        onClick={() => void copyInvoiceLink(inv)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-medium text-[#0F172A] transition hover:bg-slate-50"
                      >
                        {copiedId === inv.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#059669]" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-[#64748B]" />
                            Link PIX
                          </>
                        )}
                      </button>

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-medium text-[#0F172A] transition hover:bg-slate-50"
                        >
                          <MessageCircle className="h-3 w-3 text-[#64748B]" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-48 items-center justify-center text-center text-xs text-[#64748B]">
                Nenhuma cobrança vencida ou vencendo nos próximos 5 dias.
              </div>
            )}
          </div>
        </div>
      </section>

      {data && data.upgradeAlerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs">
          <span className="text-[#64748B]">
            <strong className="font-medium text-[#0F172A]">
              Clínicas no limite da faixa:
            </strong>{" "}
            {data.upgradeAlerts
              .map((u) => `${u.clinicName} (${u.alert.ratioLabel})`)
              .join(" · ")}
          </span>
          <Link
            href="/clinicas"
            className="font-medium text-[#059669] hover:underline"
          >
            Ver clínicas →
          </Link>
        </div>
      )}

      <SettleInvoiceModal
        invoice={settleTarget}
        onClose={() => setSettleTarget(null)}
        onSettled={() => void loadDashboard(competence)}
      />
    </div>
  );
}
