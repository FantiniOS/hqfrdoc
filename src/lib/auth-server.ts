import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth";

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  const trimmed = storedHash.trim();

  // Formato padrão gerado por scripts/hash-password.mjs: scrypt:<salt>:<hex>
  // Também aceita scrypt$<salt>$<hex>
  if (trimmed.startsWith("scrypt:") || trimmed.startsWith("scrypt$")) {
    const separator = trimmed.startsWith("scrypt:") ? ":" : "$";
    const parts = trimmed.split(separator);
    if (parts.length !== 3) return false;
    const [, salt, storedKeyHex] = parts;
    if (!salt || !storedKeyHex) return false;

    const storedBuf = Buffer.from(storedKeyHex, "hex");
    if (storedBuf.length === 0) return false;

    const derived = crypto.scryptSync(password, salt, storedBuf.length || SCRYPT_KEYLEN, SCRYPT_PARAMS);
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  }

  // Suporte opcional a hashes bcrypt ($2a$, $2b$, $2y$)
  if (/^\$2[aby]\$\d{2}\$/.test(trimmed)) {
    return bcrypt.compare(password, trimmed);
  }

  return false;
}

export async function verifyOwnerCredentials(
  username: string,
  password: string
): Promise<{ ok: true; username: string } | { ok: false; reason: "misconfigured" | "invalid" }> {
  const expectedUser = process.env.HQ_ADMIN_USER?.trim();
  const expectedHash = process.env.HQ_ADMIN_PASSWORD_HASH?.trim();

  if (!expectedUser || !expectedHash) {
    return { ok: false, reason: "misconfigured" };
  }

  const userMatches = timingSafeStringEqual(username.trim(), expectedUser);
  const passwordMatches = await verifyPasswordHash(password, expectedHash);

  if (!userMatches || !passwordMatches) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, username: expectedUser };
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireApiSession(): Promise<
  { session: SessionPayload; errorResponse: null } | { session: null; errorResponse: NextResponse }
> {
  const session = await getServerSession();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Sessão expirada ou não autenticada." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  return { session, errorResponse: null };
}

export function verifyCronAuthorization(request: Request): {
  ok: boolean;
  status: number;
  message: string;
} {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      message: "CRON_SECRET não configurada no ambiente.",
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return {
      ok: false,
      status: 401,
      message: "Header Authorization Bearer ausente ou inválido.",
    };
  }

  const token = authHeader.slice(prefix.length).trim();
  if (!token || !timingSafeStringEqual(token, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      message: "Token de cron inválido.",
    };
  }

  return { ok: true, status: 200, message: "OK" };
}
