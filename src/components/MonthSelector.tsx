"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getCompetenceLabel,
  getTodaySaoPaulo,
  shiftCompetence,
} from "@/lib/format";

export function MonthSelector({
  competence,
  onChange,
}: {
  competence: string;
  onChange: (nextCompetence: string) => void;
}) {
  const currentCompetence = getTodaySaoPaulo().competence;
  const isCurrentMonth = competence === currentCompetence;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, -1))}
        aria-label="Mês anterior"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="min-w-[138px] px-2 text-center text-xs font-medium text-[#0F172A]">
        {getCompetenceLabel(competence)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, 1))}
        aria-label="Próximo mês"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onChange(currentCompetence)}
          className="ml-0.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-[#0F172A] transition hover:bg-slate-200/70"
        >
          Atual
        </button>
      )}
    </div>
  );
}
