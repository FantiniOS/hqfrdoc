"use client";

import { useEffect, useState } from "react";
import type { PaymentMethod } from "@prisma/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SlideOverDrawer } from "@/components/SlideOverDrawer";
import { formatBRL, formatDateBR, getTodaySaoPaulo } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/pricing";

export interface SettleTargetInvoice {
  id: string;
  clinicName: string;
  description: string;
  amountCents: number;
  dueDate: string;
}

const METHODS: PaymentMethod[] = ["PIX", "BOLETO", "CARD", "TRANSFER"];

export function SettleInvoiceModal({
  invoice,
  onClose,
  onSettled,
}: {
  invoice: SettleTargetInvoice | null;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [paidAt, setPaidAt] = useState(getTodaySaoPaulo().ymd);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [receiptNote, setReceiptNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setPaidAt(getTodaySaoPaulo().ymd);
      setPaymentMethod("PIX");
      setReceiptNote("");
      setError(null);
    }
  }, [invoice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settle",
          paidAt,
          paymentMethod,
          receiptNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível registrar o pagamento.");
        setSaving(false);
        return;
      }
      onSettled();
      onClose();
    } catch {
      setError("Erro de conexão ao dar baixa na fatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlideOverDrawer
      open={Boolean(invoice)}
      title="Registrar Recebimento"
      subtitle="Confirme a data e a forma de pagamento para liquidar a fatura."
      widthClass="max-w-md"
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
            form="settle-invoice-form"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirmar Baixa
          </button>
        </div>
      }
    >
      {invoice && (
        <form id="settle-invoice-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {invoice.clinicName}
                </p>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {invoice.description} · Venc. {formatDateBR(invoice.dueDate)}
                </p>
              </div>
              <span className="font-mono-num text-sm font-semibold text-[#059669]">
                {formatBRL(invoice.amountCents)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
              Data do pagamento
            </label>
            <input
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
              Método utilizado
            </label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((method) => {
                const selected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      selected
                        ? "border-[#059669] bg-emerald-50/70 text-[#059669]"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#0F172A]">
              Identificador / Observação (opcional)
            </label>
            <input
              type="text"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              placeholder="Ex.: ID da transação PIX E2E"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </form>
      )}
    </SlideOverDrawer>
  );
}
