"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceType } from "@prisma/client";
import { Loader2, Receipt, X } from "lucide-react";
import {
  centsToReaisString,
  formatBRL,
  getShortCompetenceLabel,
  getTodaySaoPaulo,
  parseBRLToCents,
  shiftCompetence,
} from "@/lib/format";
import { INVOICE_TYPE_LABELS } from "@/lib/pricing";

export interface ClinicOption {
  id: string;
  name: string;
  status: string;
  setupFeeCents: number;
  monthlyFeeCents: number;
  dueDay: number;
}

const SERVICE_TYPES: InvoiceType[] = [
  "SETUP",
  "MIGRATION",
  "EXTRA_TRAINING",
  "PDF_CUSTOMIZATION",
  "OTHER_SERVICE",
  "MONTHLY",
];

export function CreateInvoiceModal({
  open,
  clinics,
  defaultCompetence,
  onClose,
  onCreated,
}: {
  open: boolean;
  clinics: ClinicOption[];
  defaultCompetence: string;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [clinicId, setClinicId] = useState("");
  const [type, setType] = useState<InvoiceType>("SETUP");
  const [description, setDescription] = useState("Setup Inicial");
  const [amountInput, setAmountInput] = useState("1800,00");
  const [dueDate, setDueDate] = useState(getTodaySaoPaulo().ymd);
  const [installments, setInstallments] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClinic = useMemo(
    () => clinics.find((c) => c.id === clinicId) ?? null,
    [clinics, clinicId]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    const first = clinics[0] ?? null;
    setClinicId(first?.id ?? "");
    setType("SETUP");
    setDescription("Setup Inicial");
    setAmountInput(first ? centsToReaisString(first.setupFeeCents) : "1800,00");
    setInstallments(1);

    // Data padrão dentro da competência aberta
    const today = getTodaySaoPaulo();
    if (defaultCompetence === today.competence) {
      setDueDate(today.ymd);
    } else {
      const day = String(Math.min(first?.dueDay ?? 10, 28)).padStart(2, "0");
      setDueDate(`${defaultCompetence}-${day}`);
    }
  }, [open, clinics, defaultCompetence]);

  function handleClinicChange(nextId: string) {
    setClinicId(nextId);
    const clinic = clinics.find((c) => c.id === nextId);
    if (!clinic) return;
    if (type === "SETUP") {
      setAmountInput(centsToReaisString(clinic.setupFeeCents));
    } else if (type === "MONTHLY") {
      setAmountInput(centsToReaisString(clinic.monthlyFeeCents));
    }
  }

  function handleTypeChange(nextType: InvoiceType) {
    setType(nextType);
    setDescription(INVOICE_TYPE_LABELS[nextType]);
    if (nextType !== "SETUP") {
      setInstallments(1);
    }
    if (selectedClinic) {
      if (nextType === "SETUP") {
        setAmountInput(centsToReaisString(selectedClinic.setupFeeCents));
      } else if (nextType === "MONTHLY") {
        setAmountInput(centsToReaisString(selectedClinic.monthlyFeeCents));
      } else {
        setAmountInput("");
      }
    }
  }

  const installmentPreview = useMemo(() => {
    if (type !== "SETUP" || installments <= 1) return [];
    const totalCents = parseBRLToCents(amountInput);
    if (totalCents <= 0 || dueDate.length < 7) return [];

    const baseComp = dueDate.slice(0, 7);
    const basePart = Math.floor(totalCents / installments);
    const remainder = totalCents - basePart * installments;

    return Array.from({ length: installments }, (_, idx) => {
      const comp = idx === 0 ? baseComp : shiftCompetence(baseComp, idx);
      return {
        num: idx + 1,
        label: getShortCompetenceLabel(comp),
        cents: idx === 0 ? basePart + remainder : basePart,
      };
    });
  }, [type, installments, amountInput, dueDate]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = parseBRLToCents(amountInput);
    if (!clinicId) {
      setError("Selecione uma clínica.");
      return;
    }
    if (amountCents <= 0) {
      setError("Informe um valor maior que R$ 0,00.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          type,
          description,
          amountCents,
          dueDate,
          installments: type === "SETUP" ? installments : 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar lançamento.");
        setSaving(false);
        return;
      }

      const count = data.createdCount ?? 1;
      onCreated(
        count > 1
          ? `Setup parcelado lançado em ${count} parcelas mensais com sucesso.`
          : "Lançamento avulso registrado com sucesso."
      );
      onClose();
    } catch {
      setError("Falha de conexão ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0f1623] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-400">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Novo Lançamento Avulso
              </h2>
              <p className="text-xs text-slate-400">
                Setup Inicial (1x a 3x) ou Serviços Opcionais
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {clinics.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
              Cadastre pelo menos uma clínica antes de criar lançamentos avulsos.
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Clínica *
                </label>
                <select
                  required
                  value={clinicId}
                  onChange={(e) => handleClinicChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                >
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Tipo de Cobrança *
                </label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as InvoiceType)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INVOICE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Setup Inicial, Migração de prontuários..."
                  className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Valor Total (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="1800,00"
                    className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 font-mono-num text-sm text-emerald-300 outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    {type === "SETUP" && installments > 1
                      ? "Vencimento da 1ª Parcela *"
                      : "Data de Vencimento *"}
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Parcelamento de Setup */}
              {type === "SETUP" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Parcelamento do Setup
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInstallments(n)}
                        className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                          installments === n
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                            : "border-slate-800 bg-[#090d16] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {n === 1 ? "1x (À vista)" : `${n}x mensais`}
                      </button>
                    ))}
                  </div>

                  {installmentPreview.length > 0 && (
                    <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-[#090d16] p-3">
                      <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                        Parcelas que serão geradas automaticamente:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {installmentPreview.map((p) => (
                          <span
                            key={p.num}
                            className="rounded-lg border border-slate-800 bg-[#0f1623] px-2.5 py-1 font-mono-num text-[11px] text-slate-200"
                          >
                            {p.num}/{installments} ({p.label}):{" "}
                            <strong className="text-emerald-300">
                              {formatBRL(p.cents)}
                            </strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || clinics.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lançar Fatura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
