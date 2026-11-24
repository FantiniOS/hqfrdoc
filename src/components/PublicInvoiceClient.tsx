"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/format";

interface PublicInvoiceResponse {
  invoice: {
    id: string;
    publicToken: string;
    typeLabel: string;
    competence: string;
    description: string;
    amountCents: number;
    dueDate: string;
    status: "OPEN" | "PAID" | "CANCELED";
    paidAt: string | null;
    displayStatus: "PAID" | "OPEN" | "DUE_SOON" | "OVERDUE" | "CANCELED";
    statusLabel: string;
    clinicName: string;
    clinicTradeName: string;
    clinicCnpj: string | null;
  };
  beneficiary: {
    companyName: string;
    holderName: string;
    pixKey: string;
    pixKeyType: string;
  };
  pix: {
    brCode: string | null;
    qrSvg: string | null;
  };
}

export function PublicInvoiceClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicInvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "Fatura não encontrada.");
          return;
        }
        setData(json);
      } catch {
        setError("Falha de conexão ao carregar a fatura.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function handleCopyPix() {
    if (!data?.pix.brCode) return;
    await navigator.clipboard.writeText(data.pix.brCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-[#64748B]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#059669]" />
        Carregando fatura...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm font-semibold text-[#0F172A]">
            {error ?? "Fatura indisponível"}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Verifique o link recebido ou entre em contato com o suporte FRdoc.
          </p>
        </div>
      </div>
    );
  }

  const { invoice, beneficiary, pix } = data;
  const isPaid = invoice.status === "PAID";
  const isOverdue = invoice.displayStatus === "OVERDUE";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10 text-[#0F172A]">
      <div className="w-full max-w-md space-y-4">
        {/* Marca */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[#059669]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
              {beneficiary.companyName}
            </span>
          </div>
          <span className="font-mono-num text-xs text-[#64748B]">
            #{invoice.id.slice(-6).toUpperCase()}
          </span>
        </div>

        {/* Cartão da Fatura */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#64748B]">
                {invoice.typeLabel}
              </p>
              <h1 className="mt-0.5 text-base font-semibold text-[#0F172A]">
                {invoice.description}
              </h1>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isPaid
                  ? "border-emerald-200 bg-emerald-50 text-[#059669]"
                  : isOverdue
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-[#0F172A]"
              }`}
            >
              {invoice.statusLabel}
            </span>
          </div>

          <div className="mt-5 border-y border-[#E2E8F0] py-4">
            <p className="text-xs text-[#64748B]">Valor total</p>
            <p className="mt-1 font-mono-num text-3xl font-semibold tracking-tight text-[#0F172A]">
              {formatBRL(invoice.amountCents)}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Vencimento em{" "}
              <strong className="font-mono-num font-medium text-[#0F172A]">
                {formatDateBR(invoice.dueDate)}
              </strong>
            </p>
          </div>

          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-[#64748B]">Cliente</span>
              <span className="text-right font-medium text-[#0F172A]">
                {invoice.clinicName}
              </span>
            </div>
            {invoice.clinicCnpj && (
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">CNPJ</span>
                <span className="font-mono-num text-[#0F172A]">
                  {invoice.clinicCnpj}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-[#64748B]">Favorecido</span>
              <span className="text-right font-medium text-[#0F172A]">
                {beneficiary.holderName}
              </span>
            </div>
          </div>

          {/* Área de Pagamento PIX ou Comprovante */}
          {isPaid ? (
            <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-[#059669]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Pagamento confirmado
                {invoice.paidAt ? ` em ${formatDateBR(invoice.paidAt)}` : ""}.
                Obrigado!
              </span>
            </div>
          ) : pix.brCode && pix.qrSvg ? (
            <div className="mt-6 space-y-4 border-t border-[#E2E8F0] pt-5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#0F172A]">
                <QrCode className="h-3.5 w-3.5 text-[#059669]" />
                <span>Pague instantaneamente via PIX</span>
              </div>

              <div
                className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-white p-2"
                dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
              />

              <div className="space-y-2">
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-mono-num text-[11px] break-all text-[#64748B]">
                  {pix.brCode}
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopyPix()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Código PIX copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar código PIX (Copia e Cola)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-center text-xs text-[#64748B]">
              QR Code PIX em configuração pelo administrador.
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#64748B]">
          Ambiente seguro FRdoc · Pagamento direto via PIX Banco Central
        </p>
      </div>
    </div>
  );
}
