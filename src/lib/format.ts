const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTH_NAMES_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function formatBRL(cents: number): string {
  return BRL_FORMATTER.format((cents || 0) / 100);
}

export function formatBRLCompact(cents: number): string {
  const value = (cents || 0) / 100;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const formatted = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(".", ",");
    return `${sign}R$ ${formatted}k`;
  }
  return `${sign}R$ ${Math.round(abs)}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

/**
 * Converte texto em reais ("1.290,50", "1290.50", "R$ 790,00") para centavos inteiros.
 */
export function parseBRLToCents(raw: string | number): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  }
  const cleaned = raw.replace(/[R$\s]/g, "").trim();
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Formato pt-BR: 1.290,50
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function centsToReaisString(cents: number): string {
  return ((cents || 0) / 100).toFixed(2).replace(".", ",");
}

/**
 * Retorna a data atual no fuso de Brasília (America/Sao_Paulo).
 */
export function getTodaySaoPaulo(): {
  year: number;
  month: number;
  day: number;
  ymd: string;
  competence: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "2026");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return {
    year,
    month,
    day,
    ymd: `${year}-${mm}-${dd}`,
    competence: `${year}-${mm}`,
  };
}

/**
 * Converte YYYY-MM-DD em Date UTC às 12:00:00Z (evita deslocamento de 1 dia por fuso).
 */
export function parseDateInputToUTC(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) {
    const parsed = new Date(ymd);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function dateToInputYMD(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}/${m}/${y}`;
}

/**
 * Diferença em dias inteiros entre dueDate e hoje (America/Sao_Paulo).
 * Negativo = atrasado; 0 = vence hoje; positivo = dias restantes até o vencimento.
 */
export function getDaysDiffFromToday(dueDate: Date | string): number {
  const today = getTodaySaoPaulo();
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const dueUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

export function isValidCompetence(competence: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(competence);
}

export function getCompetenceLabel(competence: string): string {
  if (!isValidCompetence(competence)) return competence;
  const [yStr, mStr] = competence.split("-");
  const mIdx = Number(mStr) - 1;
  return `${MONTH_NAMES_FULL[mIdx]} / ${yStr}`;
}

export function getShortCompetenceLabel(competence: string): string {
  if (!isValidCompetence(competence)) return competence;
  const [yStr, mStr] = competence.split("-");
  const mIdx = Number(mStr) - 1;
  return `${MONTH_NAMES_SHORT[mIdx]}/${yStr.slice(2)}`;
}

export function shiftCompetence(competence: string, deltaMonths: number): string {
  const [yStr, mStr] = competence.split("-");
  const baseDate = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1));
  const y = baseDate.getUTCFullYear();
  const m = String(baseDate.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getLastNCompetences(endCompetence: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(shiftCompetence(endCompetence, -i));
  }
  return result;
}

export function buildDueDateForCompetence(competence: string, dueDay: number): Date {
  const [yStr, mStr] = competence.split("-");
  const clampedDay = Math.min(Math.max(1, Math.trunc(dueDay)), 28);
  return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, clampedDay, 12, 0, 0));
}

export function normalizeSubdomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

  if (!cleaned) return null;
  if (!cleaned.includes(".")) {
    cleaned = `${cleaned}.frdoc.com.br`;
  }
  return cleaned;
}

export function getSubdomainUrl(subdomain: string | null | undefined): string | null {
  const normalized = normalizeSubdomain(subdomain);
  if (!normalized) return null;
  return `https://${normalized}`;
}

export function addOneYearUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), date.getUTCDate(), 12, 0, 0)
  );
}
