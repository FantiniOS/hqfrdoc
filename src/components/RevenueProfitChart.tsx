"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL, formatBRLCompact } from "@/lib/format";

export interface ChartPoint {
  competence: string;
  label: string;
  receivedCents: number;
  costsAndTaxesCents: number;
  netProfitCents: number;
  received: number;
  costsAndTaxes: number;
  netProfit: number;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
  }>;
}

function ExecutiveTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-[#0b111e]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md">
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-300 uppercase">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div
            key={entry.dataKey ?? entry.name}
            className="flex items-center justify-between gap-5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-300">{entry.name}</span>
            </div>
            <span className="font-mono-num font-semibold text-white">
              {formatBRL(Math.round((entry.value ?? 0) * 100))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueProfitChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-[310px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
          barGap={4}
          barCategoryGap="24%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148, 163, 184, 0.12)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={68}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(val: number) => formatBRLCompact(Math.round(val * 100))}
          />
          <Tooltip
            content={<ExecutiveTooltip />}
            cursor={{ fill: "rgba(148, 163, 184, 0.06)" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={34}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }}
          />
          <Bar
            dataKey="received"
            name="Faturamento Recebido"
            fill="#38bdf8"
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            dataKey="costsAndTaxes"
            name="Custos + Impostos"
            fill="#f59e0b"
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            dataKey="netProfit"
            name="Lucro Líquido"
            fill="#10b981"
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
