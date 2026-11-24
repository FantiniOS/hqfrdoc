"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function SlideOverDrawer({
  open,
  title,
  subtitle,
  widthClass = "max-w-xl",
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  widthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop discreto */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`flex h-full w-screen ${widthClass} flex-col border-l border-[#E2E8F0] bg-white shadow-2xl`}
        >
          {/* Header fixo */}
          <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-6 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#0F172A]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar gaveta"
              className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Corpo rolável */}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {/* Rodapé opcional fixo */}
          {footer && (
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
