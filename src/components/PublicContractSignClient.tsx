"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eraser,
  FileCheck2,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { formatSetupInstallmentsLabel } from "@/lib/contract";
import { formatBRL, formatDateBR } from "@/lib/format";

interface PublicContractData {
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
  penaltyPctSnapshot: number;
  courtSnapshot: string;
  clinicName: string;
  clinicLegalNameSnapshot: string | null;
  clinicCnpjSnapshot: string | null;
  clinicSubdomainSnapshot: string | null;
  hqLegalNameSnapshot: string | null;
  hqCnpjSnapshot: string | null;
  fidelityMonths: number;
  startDate: string;
  endDate: string;
  signedAt: string | null;
  signerName: string | null;
  signerCpf: string | null;
  signerIp: string | null;
  suggestedSignerName: string;
  suggestedSignerCpf: string;
}

function maskCpfInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function PublicContractSignClient({ token }: { token: string }) {
  const [contract, setContract] = useState<PublicContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const loadContract = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/public/contracts/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(json.error ?? "Contrato não encontrado.");
        return;
      }
      const c: PublicContractData = json.contract;
      setContract(c);
      setSignerName(c.signerName || c.suggestedSignerName || "");
      setSignerCpf(maskCpfInput(c.signerCpf || c.suggestedSignerCpf || ""));
    } catch {
      setLoadError("Erro de conexão ao carregar o contrato.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  // Prepara canvas com escala HiDPI nítida
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || contract?.status === "SIGNED") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(150 * dpr);
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0F172A";
  }, [contract?.status, loading]);

  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const signatureDataUrl =
        hasStroke && canvasRef.current
          ? canvasRef.current.toDataURL("image/png")
          : null;

      const res = await fetch(`/api/public/contracts/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          signerCpf,
          acceptedTerms,
          signatureDataUrl,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error ?? "Não foi possível concluir a assinatura.");
        setSubmitting(false);
        return;
      }

      await loadContract();
    } catch {
      setSubmitError("Falha de conexão ao registrar assinatura.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-[#64748B]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#059669]" />
        Carregando contrato...
      </div>
    );
  }

  if (loadError || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm font-semibold text-[#0F172A]">
            {loadError ?? "Contrato indisponível"}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Solicite um novo link atualizado ao administrador da FRdoc.
          </p>
        </div>
      </div>
    );
  }

  const isSigned = contract.status === "SIGNED";
  const cleanText = contract.contentSnapshot.replace(/=== PAGE_BREAK ===/g, "\n────────────────────────────────────────\n");

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Cabeçalho FRdoc */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[#059669]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
                  FRdoc 2.0
                </span>
                <span className="text-xs text-[#64748B]">
                  · Assinatura Eletrônica
                </span>
              </div>
              <p className="font-mono-num text-[11px] text-[#64748B]">
                REF: FRDOC-{contract.id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSigned ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-[#059669]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Assinado Eletronicamente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Aguardando Assinatura
              </span>
            )}
          </div>
        </header>

        {/* Quadro Resumo Comercial */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="text-xs font-semibold tracking-wider text-[#64748B] uppercase">
            Quadro Resumo Comercial (Anexo I)
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#E2E8F0] pt-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#64748B]">Contratante</p>
              <p className="mt-0.5 font-medium text-[#0F172A]">
                {contract.clinicLegalNameSnapshot || contract.clinicName}
              </p>
              {contract.clinicCnpjSnapshot && (
                <p className="font-mono-num text-xs text-[#64748B]">
                  CNPJ {contract.clinicCnpjSnapshot}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Plano & Mensalidade</p>
              <p className="mt-0.5 font-mono-num font-semibold text-[#059669]">
                {formatBRL(contract.monthlyFeeSnapshot)}/mês
              </p>
              <p className="text-xs text-[#64748B]">
                {contract.planSnapshot} · Venc. dia{" "}
                {String(contract.dueDaySnapshot).padStart(2, "0")}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Setup & Fidelidade</p>
              <p className="mt-0.5 font-mono-num font-medium text-[#0F172A]">
                {formatBRL(contract.setupFeeSnapshot)} (
                {formatSetupInstallmentsLabel(
                  contract.setupFeeSnapshot,
                  contract.setupInstallments
                )}
                )
              </p>
              <p className="text-xs text-[#64748B]">
                {contract.fidelityMonths} meses ({formatDateBR(contract.startDate)} a{" "}
                {formatDateBR(contract.endDate)})
              </p>
            </div>
          </div>
        </section>

        {/* Texto Integral do Contrato */}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="mb-3 flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-xs font-semibold tracking-wider text-[#64748B] uppercase">
              Instrumento Contratual Completo e Anexos
            </h2>
            <span className="font-mono-num text-[11px] text-[#64748B]">
              SHA-256: {contract.documentHash.slice(0, 16)}...
            </span>
          </div>

          <div className="max-h-[460px] overflow-y-auto pr-2 text-[13px] leading-relaxed whitespace-pre-line text-slate-700">
            {cleanText}
          </div>
        </section>

        {/* Bloco de Assinatura ou Certificado */}
        {isSigned ? (
          <section className="rounded-xl border border-emerald-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#059669]">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">
                    Contrato Assinado e Certificado (Lei nº 14.063/2020)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Assinado por <strong>{contract.signerName}</strong> (CPF{" "}
                    {contract.signerCpf}) em{" "}
                    {contract.signedAt
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        }).format(new Date(contract.signedAt))
                      : "—"}{" "}
                    · IP {contract.signerIp}
                  </p>
                </div>
              </div>

              <a
                href={`/api/public/contracts/${encodeURIComponent(token)}?format=pdf`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Baixar Contrato PDF
              </a>
            </div>

            <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 font-mono-num text-[11px] break-all text-[#64748B]">
              Hash SHA-256: {contract.documentHash}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#059669]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Formalização e Assinatura Eletrônica
              </h2>
            </div>

            <form onSubmit={handleSign} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Nome Completo do Representante Legal *
                  </label>
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nome completo sem abreviações"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    CPF do Representante Legal *
                  </label>
                  <input
                    type="text"
                    required
                    value={signerCpf}
                    onChange={(e) => setSignerCpf(maskCpfInput(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono-num text-sm text-[#0F172A] placeholder-slate-400 outline-none transition focus:border-[#059669] focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
              </div>

              {/* Canvas de Rubrica */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-[#0F172A]">
                    Assinatura / Rubrica no Quadro (opcional com aceite expresso)
                  </label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Limpar
                  </button>
                </div>
                <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="h-[150px] w-full cursor-crosshair touch-none bg-white"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs leading-relaxed text-[#0F172A]">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#059669]"
                />
                <span>
                  Declaro que li, conferi o Quadro Resumo Comercial e concordo
                  integralmente com todas as cláusulas deste Contrato e seus Anexos,
                  firmando-o eletronicamente nos termos da Medida Provisória nº
                  2.200-2/2001 e da Lei nº 14.063/2020.
                </span>
              </label>

              {submitError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando assinatura criptográfica...
                  </>
                ) : (
                  "Assinar Eletronicamente"
                )}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
