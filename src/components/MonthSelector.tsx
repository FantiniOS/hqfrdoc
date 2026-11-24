"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, -1))}
        aria-label="Mês anterior"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex min-w-[155px] items-center justify-center gap-2 px-2 text-sm font-medium text-slate-900">
        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
        <span>{getCompetenceLabel(competence)}</span>
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, 1))}
        aria-label="Próximo mês"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onChange(currentCompetence)}
          className="ml-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}
