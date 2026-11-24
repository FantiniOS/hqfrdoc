"use client";

import { useCallback, useEffect, useState } from "react";
import type { BillingCycle } from "@prisma/client";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { SlideOverDrawer } from "@/components/SlideOverDrawer";
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
  companyLegalName: string;
  companyCnpj: string;
  companyAddress: string;
  companyRepName: string;
  companyRepCpf: string;
  contractCourt: string;
  defaultFidelityMonths: number;
  defaultFidelityPenaltyPct: number;
  defaultSuspensionDays: number;
  supportChannel: string;
  supportHours: string;
}

const PIX_KEY_TYPES = ["CNPJ", "E-mail", "Telefone", "Chave Aleatória", "CPF"];

const DEFAULT_SETTINGS: HqSettingsState = {
  taxRatePercent: 6.0,
  taxRegimeLabel: "Simples Nacional — Anexo III",
  pixKey: "",
  pixKeyType: "CNPJ",
  pixHolderName: "FRdoc",
  companyName: "FRdoc",
  companyLegalName: "",
  companyCnpj: "",
  companyAddress: "",
  companyRepName: "",
  companyRepCpf: "",
  contractCourt: "Contagem/MG",
  defaultFidelityMonths: 12,
  defaultFidelityPenaltyPct: 30,
  defaultSuspensionDays: 15,
  supportChannel: "WhatsApp",
  supportHours: "Segunda a sexta, das 08h às 18h",
};

export function SettingsClient() {
  const [fixedCosts, setFixedCosts] = useState<FixedCostRow[]>([]);
  const [totalFixedCents, setTotalFixedCents] = useState(0);
  const [settings, setSettings] = useState<HqSettingsState>(DEFAULT_SETTINGS);
  const [taxRateInput, setTaxRateInput] = useState("6,0");

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [costDrawerOpen, setCostDrawerOpen] = useState(false);
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
          const raw = settingsJson.settings;
          const s: HqSettingsState = {
            taxRatePercent: raw.taxRatePercent ?? 6.0,
            taxRegimeLabel: raw.taxRegimeLabel ?? "Simples Nacional — Anexo III",
            pixKey: raw.pixKey ?? "",
            pixKeyType: raw.pixKeyType ?? "CNPJ",
            pixHolderName: raw.pixHolderName ?? "FRdoc",
            companyName: raw.companyName ?? "FRdoc",
            companyLegalName: raw.companyLegalName ?? "",
            companyCnpj: raw.companyCnpj ?? "",
            companyAddress: raw.companyAddress ?? "",
            companyRepName: raw.companyRepName ?? "",
            companyRepCpf: raw.companyRepCpf ?? "",
            contractCourt: raw.contractCourt ?? "Contagem/MG",
            defaultFidelityMonths: raw.defaultFidelityMonths ?? 12,
            defaultFidelityPenaltyPct: raw.defaultFidelityPenaltyPct ?? 30,
            defaultSuspensionDays: raw.defaultSuspensionDays ?? 15,
            supportChannel: raw.supportChannel ?? "WhatsApp",
            supportHours: raw.supportHours ?? "Segunda a sexta, das 08h às 18h",
          };
          setSettings(s);
          setTaxRateInput(String(s.taxRatePercent).replace(".", ","));
        }
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro ao carregar configurações.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openNewCostDrawer() {
    setEditingCost(null);
    setCostName("");
    setCostCategory("Infraestrutura");
    setCostAmountInput("");
    setCostCycle("MONTHLY");
    setCostNotes("");
    setCostDrawerOpen(true);
  }

  function openEditCostDrawer(cost: FixedCostRow) {
    setEditingCost(cost);
    setCostName(cost.name);
    setCostCategory(cost.category);
    setCostAmountInput(centsToReaisString(cost.monthlyAmountCents));
    setCostCycle(cost.billingCycle);
    setCostNotes(cost.notes ?? "");
    setCostDrawerOpen(true);
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
        setCostDrawerOpen(false);
        setFeedback({
          type: "success",
          text: editingCost ? "Custo atualizado." : "Custo fixo adicionado.",
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
    if (!window.confirm(`Remover "${cost.name}"?`)) return;
    const res = await fetch(`/api/fixed-costs/${cost.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleSeedDefaults() {
    setSeeding(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/fixed-costs/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: "success", text: data.message ?? "Custos carregados." });
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

  async function persistAllSettings(
    section: "fiscal" | "contract",
    successMessage: string
  ) {
    if (section === "fiscal") setSavingSettings(true);
    else setSavingContract(true);
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
        setFeedback({ type: "success", text: successMessage });
      }
    } catch {
      setFeedback({ type: "error", text: "Falha de comunicação." });
    } finally {
      if (section === "fiscal") setSavingSettings(false);
      else setSavingContract(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[#0F172A]">
          Configurações
        </h1>
        <p className="text-xs text-[#64748B]">
          Custos fixos da operação, tributação, chave PIX EMV oficial e dados jurídicos da Contratada.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50/70 text-[#059669]"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-4 text-[11px] font-medium opacity-75 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Custos Fixos */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Custos Fixos Mensais
              </h2>
              <p className="text-xs text-[#64748B]">
                Total ativo:{" "}
                <strong className="font-mono-num text-[#0F172A]">
                  {formatBRL(totalFixedCents)}/mês
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSeedDefaults()}
                disabled={seeding}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50 disabled:opacity-50"
              >
                {seeding ? "Carregando..." : "Padrões FRdoc"}
              </button>
              <button
                type="button"
                onClick={openNewCostDrawer}
                className="inline-flex items-center gap-1 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center text-xs text-[#64748B]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#059669]" />
              Carregando...
            </div>
          ) : fixedCosts.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              Nenhum custo fixo cadastrado. Clique em &ldquo;Padrões FRdoc&rdquo; para
              inserir os custos iniciais sugeridos.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {fixedCosts.map((cost) => (
                <div
                  key={cost.id}
                  className={`flex items-center justify-between gap-3 py-3 ${
                    cost.active ? "" : "opacity-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {cost.name}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {cost.category} ·{" "}
                      {cost.billingCycle === "ANNUAL"
                        ? "Rateio anual"
                        : "Mensal"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="font-mono-num text-xs font-semibold text-[#0F172A]">
                      {formatBRL(cost.monthlyAmountCents)}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleToggleCost(cost)}
                      title={cost.active ? "Desativar" : "Ativar"}
                      className={`h-4 w-8 rounded-full p-0.5 transition ${
                        cost.active ? "bg-[#059669]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                          cost.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditCostDrawer(cost)}
                      aria-label={`Editar ${cost.name}`}
                      className="rounded p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteCost(cost)}
                      aria-label={`Remover ${cost.name}`}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tributação e Chave PIX EMV */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 lg:col-span-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void persistAllSettings(
                "fiscal",
                "Alíquota e Chave PIX EMV salvas com sucesso."
              );
            }}
            className="space-y-5"
          >
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Imposto & Chave PIX Oficial (EMV)
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyTaxShortcut(6.0, "Simples Nacional — Anexo III")
                  }
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    Math.abs(settings.taxRatePercent - 6.0) < 0.01
                      ? "border-[#059669] bg-emerald-50/60 text-[#059669]"
                      : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-slate-50"
                  }`}
                >
                  <span className="font-mono-num font-semibold">6%</span> · Anexo III
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyTaxShortcut(15.5, "Simples Nacional — Anexo V")
                  }
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    Math.abs(settings.taxRatePercent - 15.5) < 0.01
                      ? "border-[#059669] bg-emerald-50/60 text-[#059669]"
                      : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-slate-50"
                  }`}
                >
                  <span className="font-mono-num font-semibold">15,5%</span> · Anexo V
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
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
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Regime
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
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Tipo PIX
                  </label>
                  <select
                    value={settings.pixKeyType}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, pixKeyType: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  >
                    {PIX_KEY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Chave PIX (usada no QR Code)
                  </label>
                  <input
                    type="text"
                    value={settings.pixKey}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, pixKey: e.target.value }))
                    }
                    placeholder="CNPJ, e-mail, celular ou EVP"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
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
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Marca ({formatPercent(settings.taxRatePercent)})
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
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingSettings ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar Imposto e PIX
            </button>
          </form>
        </section>
      </div>

      {/* Dados da Contratada & Regras de Contrato */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void persistAllSettings(
              "contract",
              "Dados da Contratada e regras de contrato atualizados."
            );
          }}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Dados da Contratada & Regras de Contrato
              </h2>
              <p className="text-xs text-[#64748B]">
                Utilizados na geração automática de contratos SaaS e certificado PDF.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingContract}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingContract ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar Dados Contratuais
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Razão Social da Contratada
                </label>
                <input
                  type="text"
                  value={settings.companyLegalName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      companyLegalName: e.target.value,
                    }))
                  }
                  placeholder="FRdoc Tecnologia Médica Ltda"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  CNPJ da Contratada
                </label>
                <input
                  type="text"
                  value={settings.companyCnpj}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      companyCnpj: e.target.value,
                    }))
                  }
                  placeholder="00.000.000/0001-00"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Foro Contratual
                </label>
                <input
                  type="text"
                  required
                  value={settings.contractCourt}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      contractCourt: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Endereço Completo da Sede
                </label>
                <input
                  type="text"
                  value={settings.companyAddress}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      companyAddress: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Representante Legal
                </label>
                <input
                  type="text"
                  value={settings.companyRepName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      companyRepName: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  CPF do Representante
                </label>
                <input
                  type="text"
                  value={settings.companyRepCpf}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      companyRepCpf: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Fidelidade (meses)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  required
                  value={settings.defaultFidelityMonths}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      defaultFidelityMonths: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Multa Fidelidade (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={settings.defaultFidelityPenaltyPct}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      defaultFidelityPenaltyPct: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Suspensão (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={settings.defaultSuspensionDays}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      defaultSuspensionDays: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Canal de Suporte
                </label>
                <input
                  type="text"
                  required
                  value={settings.supportChannel}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      supportChannel: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                  Horário de Atendimento
                </label>
                <input
                  type="text"
                  required
                  value={settings.supportHours}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      supportHours: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#059669]"
                />
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Gaveta Lateral de Custo Fixo */}
      <SlideOverDrawer
        open={costDrawerOpen}
        title={editingCost ? "Editar Custo Fixo" : "Novo Custo Fixo"}
        subtitle="Despesas recorrentes da plataforma FRdoc."
        widthClass="max-w-md"
        onClose={() => setCostDrawerOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCostDrawerOpen(false)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="fixed-cost-form"
              disabled={savingCost}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingCost && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </button>
          </div>
        }
      >
        <form id="fixed-cost-form" onSubmit={handleSaveCost} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">
              Nome *
            </label>
            <input
              type="text"
              required
              value={costName}
              onChange={(e) => setCostName(e.target.value)}
              placeholder="Vercel Pro, Domínio..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Categoria
              </label>
              <input
                type="text"
                required
                value={costCategory}
                onChange={(e) => setCostCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                Valor Mensal (R$) *
              </label>
              <input
                type="text"
                required
                value={costAmountInput}
                onChange={(e) => setCostAmountInput(e.target.value)}
                placeholder="120,00"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm font-semibold text-[#0F172A] outline-none focus:border-[#059669]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">
              Periodicidade
            </label>
            <select
              value={costCycle}
              onChange={(e) => setCostCycle(e.target.value as BillingCycle)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
            >
              <option value="MONTHLY">Mensal</option>
              <option value="ANNUAL">Equivalente Mensal (Pagamento Anual)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#0F172A]">
              Observações
            </label>
            <input
              type="text"
              value={costNotes}
              onChange={(e) => setCostNotes(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669]"
            />
          </div>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
