import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function formatCnpjMask(digits: string): string {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCepMask(raw?: string | number | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhoneMask(raw?: string | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function toTitleCase(input?: string | null): string {
  if (!input) return "";
  const lowerParticles = new Set(["da", "de", "do", "das", "dos", "e", "em", "na", "no"]);
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, idx) => {
      if (word === "ltda" || word === "ltda.") return "Ltda";
      if (word === "s/a" || word === "s.a.") return "S/A";
      if (word === "me" || word === "epp") return word.toUpperCase();
      if (idx > 0 && lowerParticles.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

interface RawReceitaResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string | number;
  email?: string | null;
  ddd_telefone_1?: string | null;
  descricao_situacao_cadastral?: string;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
  }>;
}

function normalizeReceitaData(digits: string, raw: RawReceitaResponse) {
  const tipoLog = raw.descricao_tipo_de_logradouro?.trim() ?? "";
  const logradouro = raw.logradouro?.trim() ?? "";
  const streetFull = toTitleCase(`${tipoLog} ${logradouro}`.trim());
  const numero = raw.numero?.trim() || "s/n";
  const complemento = raw.complemento?.trim() ? `, ${toTitleCase(raw.complemento)}` : "";
  const bairro = raw.bairro?.trim() ? ` — ${toTitleCase(raw.bairro)}` : "";
  const cidadeUf =
    raw.municipio && raw.uf
      ? `, ${toTitleCase(raw.municipio)}/${raw.uf.trim().toUpperCase()}`
      : "";
  const cepFormatted = formatCepMask(raw.cep);
  const cepPart = cepFormatted ? ` — CEP ${cepFormatted}` : "";

  const address = streetFull
    ? `${streetFull}, ${numero}${complemento}${bairro}${cidadeUf}${cepPart}`
    : "";

  const legalName = toTitleCase(raw.razao_social) || "";
  const tradeName = toTitleCase(raw.nome_fantasia) || legalName;

  const partners = (raw.qsa ?? [])
    .filter((p) => Boolean(p?.nome_socio?.trim()))
    .map((p) => ({
      name: toTitleCase(p.nome_socio),
      role: p.qualificacao_socio?.trim() || "Sócio",
    }));

  return {
    cnpj: formatCnpjMask(digits),
    legalName,
    tradeName,
    address,
    email: raw.email?.trim().toLowerCase() || "",
    phone: formatPhoneMask(raw.ddd_telefone_1),
    statusText: raw.descricao_situacao_cadastral?.trim() || "",
    partners,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FRdocHQ/2.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  const { errorResponse } = await requireApiSession();
  if (errorResponse) return errorResponse;

  const { cnpj } = await params;
  const digits = cnpj.replace(/\D/g, "");

  if (digits.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ inválido. Informe os 14 dígitos." },
      { status: 400 }
    );
  }

  // 1ª tentativa: BrasilAPI
  try {
    const primaryRes = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`
    );
    if (primaryRes.ok) {
      const raw = (await primaryRes.json()) as RawReceitaResponse;
      return NextResponse.json(normalizeReceitaData(digits, raw), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (primaryRes.status === 404) {
      // Tenta fallback antes de retornar 404 definitivo
    }
  } catch {
    // Segue para fallback Minha Receita
  }

  // 2ª tentativa (fallback): Minha Receita
  try {
    const fallbackRes = await fetchWithTimeout(
      `https://minhareceita.org/${digits}`
    );
    if (fallbackRes.ok) {
      const raw = (await fallbackRes.json()) as RawReceitaResponse;
      return NextResponse.json(normalizeReceitaData(digits, raw), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (fallbackRes.status === 404) {
      return NextResponse.json(
        { error: "CNPJ não encontrado na base pública da Receita Federal." },
        { status: 404 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Serviço público de consulta de CNPJ indisponível no momento. Preencha os dados manualmente.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { error: "Não foi possível consultar este CNPJ." },
    { status: 404 }
  );
}
