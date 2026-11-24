"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  SlidersHorizontal,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/pagamentos", label: "Pagamentos", icon: Receipt },
  { href: "/configuracoes", label: "Custos & Config", icon: SlidersHorizontal },
] as const;

export function HqShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-2xs backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-semibold tracking-tight text-slate-900">
                FRdoc
              </span>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                HQ
              </span>
            </div>
          </Link>

          {/* Navegação 4 Abas */}
          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : item.href === "/clinicas"
                    ? pathname.startsWith("/clinicas") ||
                      pathname.startsWith("/clinics")
                    : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Usuário & Sair */}
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">{username}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Navegação mobile compacta */}
        <div className="border-t border-slate-200 bg-white px-3 py-2 md:hidden">
          <div className="grid grid-cols-4 gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : item.href === "/clinicas"
                    ? pathname.startsWith("/clinicas") ||
                      pathname.startsWith("/clinics")
                    : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
