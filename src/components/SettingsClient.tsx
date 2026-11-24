"use client";

import { useCallback, useEffect, useState } from "react";
import type { BillingCycle } from "@prisma/client";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Percent,
  Plus,
  QrCode,
  Save,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  centsToReaisString,
  formatBRL,
  formatPercent,
  parseBRLToCents,
} from "@/lib/format";

interface FixedCostRow {
  id: string;
  name: string;
  category: string;
  monthlyAmountCents: number;
  billingCycle: BillingCycle;
  active: boolean;
  notes: string | null;
}

interface HqSettingsState {
  taxRatePercent: number;
  taxRegimeLabel: string;
  pixKey: string;
  pixKeyType: string;
  pixHolderName: string;
  companyName: string;
}

const PIX_KEY_TYPES = ["CNPJ", "E-mail", "Telefone", "Chave Aleatória", "CPF"];

export function SettingsClient() {
  const [fixedCosts, setFixedCosts] = useState<FixedCostRow[]>([]);
  const [totalFixedCents, setTotalFixedCents] = useState(0);
  const [settings, setSettings] = useState<HqSettingsState>({
    taxRatePercent: 6.0,
    taxRegimeLabel: "Simples Nacional — Anexo III",
    pixKey: "",
    pixKeyType: "CNPJ",
    pixHolderName: "FRdoc",
    companyName: "FRdoc",
  });
  const [taxRateInput, setTaxRateInput] = useState("6,0");

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [costModalOpen, setCostModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCostRow | null>(null);
  const [costName, setCostName] = useState("");
  const [costCategory, setCostCategory] = useState("Infraestrutura");
  const [costAmountInput, setCostAmountInput] = useState("");
  const [costCycle, setCostCycle] = useState<BillingCycle>("MONTHLY");
  const [costNotes, setCostNotes] = useState("");
  const [savingCost, setSavingCost] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [costsRes, settingsRes] = await Promise.all([
        fetch("/api/fixed-costs", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);

      if (costsRes.ok) {
        const costsJson = await costsRes.json();
        setFixedCosts(costsJson.fixedCosts ?? []);
        setTotalFixedCents(costsJson.totalActiveMonthlyCents ?? 0);
      }

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        if (settingsJson.settings) {
          const s: HqSettingsState = {
            taxRatePercent: settingsJson.settings.taxRatePercent ?? 6.0,
            taxRegimeLabel:
              settingsJson.settings.taxRegimeLabel ?? "Simples Nacional — Anexo III",
            pixKey: settingsJson.settings.pixKey ?? "",
            pixKeyType: settingsJson.settings.pixKeyType ?? "CNPJ",
            pixHolderName: settingsJson.settings.pixHolderName ?? "FRdoc",
            companyName: settingsJson.settings.companyName ?? "FRdoc",
          };
          setSettings(s);
          setTaxRateInput(String(s.taxRatePercent).replace(".", ","));
        }
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro ao carregar custos fixos e configurações.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openNewCostModal() {
    setEditingCost(null);
    setCostName("");
    setCostCategory("Infraestrutura");
    setCostAmountInput("");
    setCostCycle("MONTHLY");
    setCostNotes("");
    setCostModalOpen(true);
  }

  function openEditCostModal(cost: FixedCostRow) {
    setEditingCost(cost);
    setCostName(cost.name);
    setCostCategory(cost.category);
    setCostAmountInput(centsToReaisString(cost.monthlyAmountCents));
    setCostCycle(cost.billingCycle);
    setCostNotes(cost.notes ?? "");
    setCostModalOpen(true);
  }

  async function handleSaveCost(e: React.FormEvent) {
    e.preventDefault();
    setSavingCost(true);
    setFeedback(null);

    const payload = {
      name: costName,
      category: costCategory,
      monthlyAmountCents: parseBRLToCents(costAmountInput),
      billingCycle: costCycle,
      active: editingCost ? editingCost.active : true,
      notes: costNotes || null,
    };

    try {
      const res = await fetch(
        editingCost ? `/api/fixed-costs/${editingCost.id}` : "/api/fixed-costs",
        {
          method: editingCost ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error ?? "Erro ao salvar custo." });
      } else {
        setCostModalOpen(false);
        setFeedback({
          type: "success",
          text: editingCost ? "Custo fixo atualizado." : "Custo fixo cadastrado.",
        });
        await loadAll();
      }
    } finally {
      setSavingCost(false);
    }
  }

  async function handleToggleCost(cost: FixedCostRow) {
    const res = await fetch(`/api/fixed-costs/${cost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !cost.active }),
    });
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleDeleteCost(cost: FixedCostRow) {
    if (!window.confirm(`Remover o custo fixo "${cost.name}"?`)) return;
    const res = await fetch(`/api/fixed-costs/${cost.id}`, { method: "DELETE" });
    if (res.ok) {
      setFeedback({ type: "success", text: "Custo fixo removido." });
      await loadAll();
    }
  }

  async function handleSeedDefaults() {
    setSeeding(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/fixed-costs/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error ?? "Erro ao aplicar seed." });
      } else {
        setFeedback({
          type: "success",
          text: data.message ?? "Custos padrão carregados.",
        });
        await loadAll();
      }
    } finally {
      setSeeding(false);
    }
  }

  function applyTaxShortcut(rate: number, label: string) {
    setSettings((prev) => ({
      ...prev,
      taxRatePercent: rate,
      taxRegimeLabel: label,
    }));
    setTaxRateInput(String(rate).replace(".", ","));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);

    const parsedRate = Number.parseFloat(taxRateInput.replace(",", "."));
    const safeRate = Number.isFinite(parsedRate) ? parsedRate : settings.taxRatePercent;

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          taxRatePercent: safeRate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error ?? "Erro ao salvar configurações.",
        });
      } else {
        setSettings((prev) => ({ ...prev, taxRatePercent: safeRate }));
        setFeedback({
          type: "success",
          text: "Configurações fiscais e Chave PIX salvas com sucesso.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Falha de comunicação ao salvar configurações.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Custos Fixos & Configurações da FRdoc
        </h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Despesas fixas da operação, alíquota tributária do painel e dados oficiais do PIX para WhatsApp.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-4 text-[11px] font-semibold opacity-75 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Esquerda (7 cols): Custos Fixos */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Custos Fixos da Plataforma
                </h2>
                <p className="text-xs text-slate-600">
                  Total mensal ativo:{" "}
                  <strong className="font-mono-num text-amber-700">
                    {formatBRL(totalFixedCents)}/mês
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSeedDefaults()}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {seeding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                )}
                Seed Inicial FRdoc
              </button>

              <button
                type="button"
                onClick={openNewCostModal}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Custo
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando custos fixos...
            </div>
          ) : fixedCosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-800">
                Nenhum custo fixo cadastrado ainda
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
                Use o botão <strong>Seed Inicial FRdoc</strong> para carregar Vercel Pro (R$ 120,00), Apple Developer (R$ 49,50) e Domínio frdoc.com.br (R$ 3,33) — totalmente editáveis.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {fixedCosts.map((cost) => (
                <div
                  key={cost.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    cost.active
                      ? "border-slate-200 bg-slate-50/70"
                      : "border-slate-200/70 bg-slate-50/40 opacity-60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {cost.name}
                      </p>
                      <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {cost.category}
                      </span>
                      <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                        {cost.billingCycle === "ANNUAL"
                          ? "Equiv. Mensal (Anual)"
                          : "Mensal"}
                      </span>
                    </div>
                    {cost.notes && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {cost.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="font-mono-num text-sm font-semibold text-amber-700">
                      {formatBRL(cost.monthlyAmountCents)}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleToggleCost(cost)}
                      title={cost.active ? "Desativar custo" : "Ativar custo"}
                      className={`h-5 w-9 rounded-full p-0.5 transition ${
                        cost.active ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white shadow-2xs transition-transform ${
                          cost.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditCostModal(cost)}
                      aria-label={`Editar ${cost.name}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteCost(cost)}
                      aria-label={`Remover ${cost.name}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Coluna Direita (5 cols): Impostos & Chave PIX */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Bloco Fiscal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600">
                  <Percent className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Alíquota de Imposto Padrão
                  </h2>
                  <p className="text-xs text-slate-600">
                    Aplicada sobre o faturamento recebido no mês
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyTaxShortcut(6.0, "Simples Nacional — Anexo III")
                  }
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    Math.abs(settings.taxRatePercent - 6.0) < 0.01
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-mono-num text-sm font-semibold">6%</p>
                  <p className="text-[11px] text-slate-600">Simples Anexo III</p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyTaxShortcut(15.5, "Simples Nacional — Anexo V")
                  }
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    Math.abs(settings.taxRatePercent - 15.5) < 0.01
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-mono-num text-sm font-semibold">15,5%</p>
                  <p className="text-[11px] text-slate-600">Simples Anexo V</p>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Alíquota (%)
                  </label>
                  <input
                    type="text"
                    required
                    value={taxRateInput}
                    onChange={(e) => {
                      setTaxRateInput(e.target.value);
                      const num = Number.parseFloat(e.target.value.replace(",", "."));
                      if (Number.isFinite(num)) {
                        setSettings((prev) => ({ ...prev, taxRatePercent: num }));
                      }
                    }}
                    placeholder="6,0"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Regime Fiscal
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.taxRegimeLabel}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        taxRegimeLabel: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Bloco PIX Oficial */}
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Chave PIX Oficial da FRdoc
                  </h2>
                  <p className="text-xs text-slate-600">
                    Inserida automaticamente nas cobranças por WhatsApp
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={settings.pixKeyType}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, pixKeyType: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {PIX_KEY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    value={settings.pixKey}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, pixKey: e.target.value }))
                    }
                    placeholder="00.000.000/0001-00 ou financeiro@frdoc.com.br"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Titular do PIX
                  </label>
                  <input
                    type="text"
                    value={settings.pixHolderName}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        pixHolderName: e.target.value,
                      }))
                    }
                    placeholder="FRdoc Tecnologia Ltda"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Nome da Marca
                  </label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        companyName: e.target.value,
                      }))
                    }
                    placeholder="FRdoc"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Pré-visualização discreta */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="text-[11px] font-semibold text-slate-600">
                  Resumo ativo no painel:
                </p>
                <p className="mt-1 text-slate-700">
                  Imposto:{" "}
                  <strong className="font-mono-num text-slate-900">
                    {formatPercent(settings.taxRatePercent)}
                  </strong>{" "}
                  ({settings.taxRegimeLabel})
                </p>
                <p className="mt-0.5 text-slate-700">
                  PIX ({settings.pixKeyType}):{" "}
                  <strong className="font-mono-num text-emerald-700">
                    {settings.pixKey || "Ainda não informado"}
                  </strong>
                  {settings.pixHolderName ? ` · ${settings.pixHolderName}` : ""}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Configurações
            </button>
          </form>
        </section>
      </div>

      {/* Modal de Custo Fixo */}
      {costModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingCost ? "Editar Custo Fixo" : "Novo Custo Fixo"}
              </h3>
              <button
                type="button"
                onClick={() => setCostModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCost} className="space-y-3.5 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Nome do Custo *
                </label>
                <input
                  type="text"
                  required
                  value={costName}
                  onChange={(e) => setCostName(e.target.value)}
                  placeholder="Ex.: Vercel Pro, Resend, Cloudflare..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Categoria
                  </label>
                  <input
                    type="text"
                    required
                    value={costCategory}
                    onChange={(e) => setCostCategory(e.target.value)}
                    placeholder="Hospedagem, Licenças..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Valor Mensal (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={costAmountInput}
                    onChange={(e) => setCostAmountInput(e.target.value)}
                    placeholder="120,00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm font-semibold text-amber-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Ciclo de Cobrança
                </label>
                <select
                  value={costCycle}
                  onChange={(e) => setCostCycle(e.target.value as BillingCycle)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="MONTHLY">Mensal</option>
                  <option value="ANNUAL">Equivalente Mensal (Pagamento Anual)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  value={costNotes}
                  onChange={(e) => setCostNotes(e.target.value)}
                  placeholder="Detalhes ou data de renovação"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCostModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCost}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingCost && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar Custo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
