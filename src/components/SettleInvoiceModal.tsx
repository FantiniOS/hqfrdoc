"use client";

import { useEffect, useState } from "react";
import type { PaymentMethod } from "@prisma/client";
import { CheckCircle2, Loader2, X } from "lucide-react";
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

  if (!invoice) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f1623] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Baixa Rápida</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Resumo da Fatura */}
          <div className="rounded-xl border border-slate-800/90 bg-[#090d16] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {invoice.clinicName}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {invoice.description} · Venc. {formatDateBR(invoice.dueDate)}
                </p>
              </div>
              <span className="shrink-0 font-mono-num text-base font-semibold text-emerald-400">
                {formatBRL(invoice.amountCents)}
              </span>
            </div>
          </div>

          {/* Data do Pagamento */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Data do pagamento
            </label>
            <input
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3.5 py-2 text-sm text-white outline-none transition focus:border-emerald-500/60"
            />
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Forma de pagamento
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((method) => {
                const selected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      selected
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-800 bg-[#090d16] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comprovante / Observação */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Observação ou ID do comprovante (opcional)
            </label>
            <input
              type="text"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              placeholder="Ex.: E2E PIX #88412 ou comprovante recebido no WhatsApp"
              className="w-full rounded-xl border border-slate-800 bg-[#090d16] px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/60"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
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
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirmar Recebimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
