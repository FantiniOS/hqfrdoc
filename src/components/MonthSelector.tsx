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
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-[#0f1623] p-1">
      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, -1))}
        aria-label="Mês anterior"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex min-w-[155px] items-center justify-center gap-2 px-2 text-sm font-medium text-white">
        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
        <span>{getCompetenceLabel(competence)}</span>
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftCompetence(competence, 1))}
        aria-label="Próximo mês"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onChange(currentCompetence)}
          className="ml-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}
