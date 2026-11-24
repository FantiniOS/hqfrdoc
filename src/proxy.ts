import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_EXACT_PAGES = new Set(["/login"]);
const PUBLIC_EXACT_APIS = new Set(["/api/auth/login", "/api/cron/keep-alive"]);

function isAllowedPublicTokenRoute(pathname: string): boolean {
  // Páginas públicas exclusivas por token criptográfico
  if (/^\/assinar\/[a-zA-Z0-9_-]{16,128}$/.test(pathname)) return true;
  if (/^\/fatura\/[a-zA-Z0-9_-]{16,128}$/.test(pathname)) return true;

  // APIs públicas exclusivas por token criptográfico
  if (/^\/api\/public\/contracts\/[a-zA-Z0-9_-]{16,128}$/.test(pathname)) return true;
  if (/^\/api\/public\/invoices\/[a-zA-Z0-9_-]{16,128}$/.test(pathname)) return true;

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/robots.txt") {
    return NextResponse.next();
  }

  if (PUBLIC_EXACT_APIS.has(pathname) || isAllowedPublicTokenRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (PUBLIC_EXACT_PAGES.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${search}`;
    if (nextPath !== "/" && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
