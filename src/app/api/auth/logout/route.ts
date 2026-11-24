import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getClearSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", getClearSessionCookieOptions());
  return response;
}
