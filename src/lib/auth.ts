import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "frdoc_hq_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 dias

const JWT_ISSUER = "frdoc-hq";
const JWT_AUDIENCE = "frdoc-hq-owner";

export interface SessionPayload {
  sub: string;
}

function getJwtSecretBytes(): Uint8Array | null {
  const secret = process.env.HQ_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return null;
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(username: string): Promise<string> {
  const secretBytes = getJwtSecretBytes();
  if (!secretBytes) {
    throw new Error("HQ_JWT_SECRET não configurada ou muito curta (mínimo 16 caracteres).");
  }

  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(username)
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretBytes);
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const secretBytes = getJwtSecretBytes();
  if (!secretBytes) return null;

  try {
    const { payload } = await jwtVerify(token, secretBytes, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || !payload.sub) {
      return null;
    }

    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function getClearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
}
