import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_PAGE_PATHS = new Set(["/login"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/cron/keep-alive"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Permite crawler ler robots.txt (Disallow: /)
  if (pathname === "/robots.txt") {
    return NextResponse.next();
  }

  // Rotas de API liberadas (cron possui validação própria de CRON_SECRET)
  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // Página de login
  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Bloqueia 100% das demais rotas /api/* sem sessão válida
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.next();
  }

  // Bloqueia 100% das páginas privadas sem sessão válida
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
