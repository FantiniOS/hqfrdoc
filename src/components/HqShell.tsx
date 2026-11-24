"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/financeiro", label: "Financeiro", icon: Receipt },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
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

  function isItemActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href === "/clinicas") {
      return pathname.startsWith("/clinicas") || pathname.startsWith("/clinics");
    }
    if (href === "/financeiro") {
      return pathname.startsWith("/financeiro") || pathname.startsWith("/pagamentos");
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Navegação Lateral Enxuta (Desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-[#E2E8F0] bg-white md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-[#E2E8F0] px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-[#059669]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
            FRdoc HQ
          </span>
        </div>

        <nav aria-label="Menu principal" className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-slate-100/90 text-[#0F172A]"
                    : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? "text-[#059669]" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E2E8F0] p-3">
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              <span className="font-medium text-[#0F172A]">{username}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              title="Encerrar sessão"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Coluna Principal */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-56">
        {/* Barra Mobile Compacta */}
        <header className="sticky top-0 z-20 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-sm md:hidden">
          <div className="flex h-13 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#059669]" />
              <span className="text-sm font-semibold text-[#0F172A]">FRdoc HQ</span>
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Sair
            </button>
          </div>
          <nav className="grid grid-cols-4 border-t border-[#E2E8F0] px-2 py-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-md py-1 text-[11px] font-medium ${
                    active ? "text-[#059669]" : "text-[#64748B]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
