"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import {
  CONTRACT_STATUS_META,
  formatSetupInstallmentsLabel,
  normalizeContractStatus,
  PLACEHOLDER_TAG,
  type MissingFieldItem,
} from "@/lib/contract";
import { formatBRL, formatDateBR } from "@/lib/format";
import { sanitizeBrazilianPhone } from "@/lib/whatsapp";

export interface InternalContractView {
  id: string;
  token: string;
  status: string;
  contentSnapshot: string;
  documentHash: string;
  planSnapshot: string;
  monthlyFeeSnapshot: number;
  setupFeeSnapshot: number;
  setupInstallments: number;
  isFounderSnapshot: boolean;
  dueDaySnapshot: number;
  infraSnapshot: string;
  fidelityMonths: number;
  startDate: string;
  endDate: string;
  signedAt: string | null;
  signerName: string | null;
  signerCpf: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  createdAt: string;
}

export function ContractClient({
  clinic,
  latestContract,
  missingFields,
}: {
  clinic: {
    id: string;
    name: string;
    whatsapp: string;
    responsibleName: string;
  };
  latestContract: InternalContractView | null;
  missingFields: MissingFieldItem[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateSnapshot() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: clinic.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar contrato.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Falha de conexão ao gerar contrato.");
    } finally {
      setGenerating(false);
    }
  }

  async function copySignLink() {
    if (!latestContract) return;
    const url = `${window.location.origin}/assinar/${latestContract.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const statusKey = normalizeContractStatus(latestContract?.status);
  const statusMeta = CONTRACT_STATUS_META[statusKey];
  const isSigned = latestContract?.status === "SIGNED";

  const phone = sanitizeBrazilianPhone(clinic.whatsapp);
  const signFullUrl =
    typeof window !== "undefined" && latestContract
      ? `${window.location.origin}/assinar/${latestContract.token}`
      : latestContract
        ? `/assinar/${latestContract.token}`
        : "";

  const waContractUrl =
    phone && latestContract
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          `Olá, ${clinic.responsibleName.split(" ")[0] || clinic.responsibleName}. Tudo bem?\n\nSegue o link exclusivo para leitura e assinatura eletrônica do Contrato SaaS FRdoc 2.0 da *${clinic.name}*:\n${signFullUrl}\n\nApós assinar, o PDF certificado fica disponível imediatamente para download.`
        )}`
      : null;

  return (
    <div className="space-y-6">
      {/* Barra Superior */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clinicas"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#0F172A]">
              Contrato — {clinic.name}
            </h1>
            <p className="text-xs text-[#64748B]">
              Assinatura eletrônica própria com hash SHA-256 e geração nativa de PDF A4.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSigned && (
            <button
              type="button"
              onClick={() => void handleGenerateSnapshot()}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : latestContract ? (
                <RefreshCw className="h-3.5 w-3.5 text-[#64748B]" />
              ) : (
                <FileSignature className="h-3.5 w-3.5 text-[#059669]" />
              )}
              {latestContract ? "Regerar revisão atualizada" : "Gerar Contrato"}
            </button>
          )}

          {latestContract && (
            <>
              <button
                type="button"
                onClick={() => void copySignLink()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#059669]" />
                    Link copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#64748B]" />
                    Copiar link /assinar
                  </>
                )}
              </button>

              {waContractUrl && !isSigned && (
                <a
                  href={waContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] transition hover:bg-slate-50"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[#64748B]" />
                  Enviar no WhatsApp
                </a>
              )}

              <a
                href={`/api/contracts/${latestContract.id}/pdf?download=1`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF A4
              </a>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Aviso de campos pendentes no cadastro antes de gerar/enviar */}
      {!isSigned && missingFields.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">
                Campos pendentes detectados ({PLACEHOLDER_TAG}):
              </p>
              <p className="mt-0.5 text-amber-800">
                {missingFields.map((m) => m.label).join(", ")}. Complete o cadastro e
                clique em &ldquo;Regerar revisão atualizada&rdquo; antes de enviar ao
                cliente.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/clinicas"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-900 hover:bg-amber-100/50"
            >
              Clínicas
            </Link>
            <Link
              href="/configuracoes"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-900 hover:bg-amber-100/50"
            >
              Configurações
            </Link>
          </div>
        </div>
      )}

      {!latestContract ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center">
          <p className="text-sm font-semibold text-[#0F172A]">
            Nenhum contrato gerado para esta clínica ainda
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#64748B]">
            Clique em <strong>Gerar Contrato</strong> para congelar o texto oficial,
            calcular o hash SHA-256 e criar o link exclusivo de assinatura eletrônica.
          </p>
          <button
            type="button"
            onClick={() => void handleGenerateSnapshot()}
            disabled={generating}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSignature className="h-3.5 w-3.5" />
            )}
            Gerar Contrato Agora
          </button>
        </div>
      ) : (
        <>
          {/* Metadados e Auditoria do Contrato */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#64748B]">Status</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`}
                />
                <span className="text-sm font-semibold text-[#0F172A]">
                  {statusMeta.label}
                </span>
              </div>
              <a
                href={`/assinar/${latestContract.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#059669] hover:underline"
              >
                Abrir página pública
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <div>
              <p className="text-xs text-[#64748B]">Plano Congelado</p>
              <p className="mt-1 font-mono-num text-sm font-semibold text-[#0F172A]">
                {formatBRL(latestContract.monthlyFeeSnapshot)}/mês
              </p>
              <p className="text-[11px] text-[#64748B]">
                {latestContract.planSnapshot}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#64748B]">Setup & Vigência</p>
              <p className="mt-1 font-mono-num text-sm font-medium text-[#0F172A]">
                {formatBRL(latestContract.setupFeeSnapshot)} (
                {formatSetupInstallmentsLabel(
                  latestContract.setupFeeSnapshot,
                  latestContract.setupInstallments
                )}
                )
              </p>
              <p className="text-[11px] text-[#64748B]">
                {formatDateBR(latestContract.startDate)} →{" "}
                {formatDateBR(latestContract.endDate)}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#64748B]">Hash SHA-256</p>
              <p
                title={latestContract.documentHash}
                className="mt-1 truncate font-mono-num text-xs text-[#0F172A]"
              >
                {latestContract.documentHash}
              </p>
              <p className="text-[11px] text-[#64748B]">
                Gerado em {formatDateBR(latestContract.createdAt)}
              </p>
            </div>
          </div>

          {/* Certificado de Assinatura quando assinado */}
          {isSigned && latestContract.signedAt && (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                <div>
                  <p className="font-semibold text-[#0F172A]">
                    Assinado eletronicamente por {latestContract.signerName} (CPF{" "}
                    {latestContract.signerCpf})
                  </p>
                  <p className="mt-0.5 text-[#64748B]">
                    Data/Hora:{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(new Date(latestContract.signedAt))}{" "}
                    · IP: {latestContract.signerIp}
                  </p>
                </div>
              </div>
              <a
                href={`/api/contracts/${latestContract.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-semibold text-[#059669] hover:underline"
              >
                Visualizar PDF com Certificado →
              </a>
            </div>
          )}

          {/* Prévia limpa do texto congelado */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
            <div className="mx-auto max-w-3xl text-[13px] leading-relaxed whitespace-pre-line text-slate-800">
              {latestContract.contentSnapshot.replace(
                /=== PAGE_BREAK ===/g,
                "\n────────────────────────────────────────\n"
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
