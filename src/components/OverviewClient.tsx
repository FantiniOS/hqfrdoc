"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
  Zap,
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

  const loadDashboard = useCallback(async (comp: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?competence=${encodeURIComponent(comp)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Erro ao carregar dashboard.");
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

  const kpis = data?.kpis;
  const hasOverdue = (kpis?.overdueCount ?? 0) > 0;
  const isProfitPositive = (kpis?.netProfitCents ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Seletor de Mês/Ano */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Visão Geral Executiva
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Faturamento, custos operacionais, impostos e caixa real da FRdoc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MonthSelector competence={competence} onChange={setCompetence} />
          <button
            type="button"
            onClick={() => void loadDashboard(competence)}
            disabled={loading}
            aria-label="Atualizar dados"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0f1623] text-slate-400 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* 5 Cards de KPI */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. MRR */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0f1623] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              MRR (Previsto)
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 font-mono-num text-xl font-semibold tracking-tight text-white">
            {kpis ? formatBRL(kpis.mrrCents) : "—"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            {kpis
              ? `${kpis.activeClinicsCount} ativa(s) · ${kpis.activeDoctorsTotal} médico(s)`
              : "Carregando..."}
          </p>
          {kpis && kpis.delinquentClinicsCount > 0 && (
            <p className="mt-1 text-[11px] text-rose-400">
              +{kpis.delinquentClinicsCount} inadimplente(s) na carteira
            </p>
          )}
        </div>

        {/* 2. Recebido no Mês */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0f1623] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Recebido no Mês
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 font-mono-num text-xl font-semibold tracking-tight text-emerald-400">
            {kpis ? formatBRL(kpis.receivedCents) : "—"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            {kpis
              ? kpis.receivedExtrasCents > 0
                ? `${kpis.paidCount} paga(s) · Extras: ${formatBRL(kpis.receivedExtrasCents)}`
                : `${kpis.paidCount} fatura(s) liquidada(s)`
              : "Carregando..."}
          </p>
        </div>

        {/* 3. A Receber / Em Atraso */}
        <div
          className={`rounded-2xl border p-4 transition ${
            hasOverdue
              ? "border-rose-500/45 bg-rose-950/15"
              : "border-slate-800/90 bg-[#0f1623]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              A Receber / Atraso
            </span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                hasOverdue
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {hasOverdue ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
            </span>
          </div>
          <p
            className={`mt-3 font-mono-num text-xl font-semibold tracking-tight ${
              hasOverdue ? "text-rose-300" : "text-white"
            }`}
          >
            {kpis ? formatBRL(kpis.receivableTotalCents) : "—"}
          </p>
          {kpis ? (
            hasOverdue ? (
              <p className="mt-1.5 text-xs font-medium text-rose-400">
                {kpis.overdueCount} vencida(s): {formatBRL(kpis.overdueCents)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">
                {kpis.openMonthCount} em aberto · Sem atrasos
              </p>
            )
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">Carregando...</p>
          )}
        </div>

        {/* 4. Custos Totais + Impostos */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0f1623] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Custos + Impostos
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/12 text-amber-400">
              <Wallet className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 font-mono-num text-xl font-semibold tracking-tight text-amber-300">
            {kpis ? formatBRL(kpis.totalCostsAndTaxesCents) : "—"}
          </p>
          {kpis ? (
            <p className="mt-1.5 truncate text-[11px] text-slate-400" title={`Infra: ${formatBRL(kpis.clinicInfraCents)} | Fixos: ${formatBRL(kpis.fixedCostsCents)} | Imposto (${formatPercent(kpis.taxRatePercent)}): ${formatBRL(kpis.taxCents)}`}>
              Infra {formatBRL(kpis.clinicInfraCents)} · Fixos{" "}
              {formatBRL(kpis.fixedCostsCents)}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">Carregando...</p>
          )}
          {kpis && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Imposto ({formatPercent(kpis.taxRatePercent)}):{" "}
              {formatBRL(kpis.taxCents)}
            </p>
          )}
        </div>

        {/* 5. Lucro Líquido Real */}
        <div
          className={`rounded-2xl border p-4 ${
            isProfitPositive
              ? "border-emerald-500/35 bg-emerald-950/15"
              : "border-rose-500/35 bg-rose-950/15"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Lucro Líquido Real
            </span>
            {kpis && (
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono-num text-[11px] font-semibold ${
                  isProfitPositive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {formatPercent(kpis.profitMarginPercent)}
              </span>
            )}
          </div>
          <p
            className={`mt-3 font-mono-num text-xl font-semibold tracking-tight ${
              isProfitPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {kpis ? formatBRL(kpis.netProfitCents) : "—"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            Sobra efetiva em caixa no mês
          </p>
        </div>
      </section>

      {/* Grid Principal: Gráfico (7 cols) + Ação Rápida (5 cols) */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Gráfico Recharts 6 meses */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0f1623] p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Evolução Financeira (Últimos 6 Meses)
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Faturamento recebido vs. custos + impostos vs. lucro líquido real
              </p>
            </div>
            <Link
              href="/configuracoes"
              className="hidden items-center gap-1 rounded-lg border border-slate-800 bg-[#090d16] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200 sm:inline-flex"
            >
              Alíquota: {kpis ? formatPercent(kpis.taxRatePercent) : "—"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {loading && !data ? (
            <div className="flex h-[310px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando gráfico...
            </div>
          ) : (
            <RevenueProfitChart data={data?.chartSeries ?? []} />
          )}
        </div>

        {/* Painel de Ação Rápida */}
        <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-[#0f1623] p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Painel de Ação Rápida
                </h2>
                <p className="text-xs text-slate-400">
                  Vencidas ou vencendo nos próximos 5 dias
                </p>
              </div>
            </div>
            <Link
              href="/pagamentos"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              Ver todas
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1" style={{ maxHeight: "310px" }}>
            {loading && !data ? (
              <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando vencimentos...
              </div>
            ) : data && data.quickActionInvoices.length > 0 ? (
              data.quickActionInvoices.map((inv) => {
                const isOverdue = inv.daysDiff < 0;
                const waUrl = buildWhatsAppChargeUrl({
                  whatsapp: inv.whatsapp,
                  responsibleName: inv.responsibleName,
                  clinicName: inv.clinicName,
                  description: inv.description,
                  amountCents: inv.amountCents,
                  dueDate: inv.dueDate,
                  pixKey: data.settings.pixKey,
                  pixKeyType: data.settings.pixKeyType,
                  pixHolderName: data.settings.pixHolderName,
                  companyName: data.settings.companyName,
                });

                return (
                  <div
                    key={inv.id}
                    className={`rounded-xl border p-3 transition ${
                      isOverdue
                        ? "border-rose-500/35 bg-rose-950/20"
                        : "border-amber-500/25 bg-amber-950/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isOverdue ? "bg-rose-400" : "bg-amber-400"
                            }`}
                          />
                          <p className="truncate text-sm font-medium text-white">
                            {inv.clinicName}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {inv.description} · Venc. {formatDateBR(inv.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono-num text-sm font-semibold text-white">
                          {formatBRL(inv.amountCents)}
                        </p>
                        <p
                          className={`text-[11px] font-medium ${
                            isOverdue ? "text-rose-400" : "text-amber-300"
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

                    <div className="mt-2.5 flex items-center gap-2">
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
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dar Baixa
                      </button>

                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
                            isOverdue
                              ? "bg-rose-500/15 text-rose-200 ring-rose-500/35 hover:bg-rose-500/25"
                              : "bg-slate-800/80 text-slate-200 ring-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Cobrar WhatsApp
                        </a>
                      ) : (
                        <span className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-slate-500">
                          Sem WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 px-4 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/70" />
                <p className="text-sm font-medium text-slate-200">
                  Tudo em dia por aqui
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Nenhuma fatura vencida ou vencendo nos próximos 5 dias.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Banner discreto de clínicas no teto da faixa (oportunidade de upgrade) */}
      {data && data.upgradeAlerts.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-950/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs">
              <span className="font-semibold text-amber-200">
                Potencial de Upgrade ({data.upgradeAlerts.length}):
              </span>{" "}
              <span className="text-slate-300">
                {data.upgradeAlerts
                  .map((u) => `${u.clinicName} (${u.alert.ratioLabel})`)
                  .join(" · ")}
              </span>
            </div>
          </div>
          <Link
            href="/clinicas"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-300 hover:text-amber-200"
          >
            Revisar clínicas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      <SettleInvoiceModal
        invoice={settleTarget}
        onClose={() => setSettleTarget(null)}
        onSettled={() => void loadDashboard(competence)}
      />
    </div>
  );
}
