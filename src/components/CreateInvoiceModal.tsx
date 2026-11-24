"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { SlideOverDrawer } from "@/components/SlideOverDrawer";
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
          ? `Setup lançado em ${count} parcelas mensais.`
          : "Cobrança registrada com QR Code PIX automático."
      );
      onClose();
    } catch {
      setError("Falha de conexão ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlideOverDrawer
      open={open}
      title="Nova Cobrança Avulsa"
      subtitle="Gera automaticamente link público /fatura com QR Code PIX EMV."
      widthClass="max-w-lg"
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
            form="create-invoice-form"
            disabled={saving || clinics.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar Cobrança
          </button>
        </div>
      }
    >
      <form id="create-invoice-form" onSubmit={handleSubmit} className="space-y-4">
        {clinics.length === 0 ? (
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B]">
            Cadastre uma clínica antes de criar cobranças avulsas.
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                Clínica
              </label>
              <select
                required
                value={clinicId}
                onChange={(e) => handleClinicChange(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as InvoiceType)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INVOICE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                Descrição na fatura
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                  Valor Total (R$)
                </label>
                <input
                  type="text"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm font-semibold text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                  {type === "SETUP" && installments > 1
                    ? "1º Vencimento"
                    : "Vencimento"}
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
            </div>

            {type === "SETUP" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
                  Parcelamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        installments === n
                          ? "border-[#059669] bg-emerald-50/70 text-[#059669]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                      }`}
                    >
                      {n === 1 ? "À vista (1x)" : `${n}x mensais`}
                    </button>
                  ))}
                </div>

                {installmentPreview.length > 0 && (
                  <div className="mt-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                    <div className="flex flex-wrap gap-2">
                      {installmentPreview.map((p) => (
                        <span
                          key={p.num}
                          className="rounded border border-[#E2E8F0] bg-white px-2 py-1 font-mono-num text-[11px] text-[#0F172A]"
                        >
                          {p.num}/{installments} ({p.label}): {formatBRL(p.cents)}
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
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
      </form>
    </SlideOverDrawer>
  );
}
