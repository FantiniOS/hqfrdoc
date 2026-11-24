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
    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-md">
      <p className="mb-1.5 text-[11px] font-semibold text-[#0F172A]">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.dataKey ?? entry.name}
            className="flex items-center justify-between gap-5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[#64748B]">{entry.name}</span>
            </div>
            <span className="font-mono-num font-semibold text-[#0F172A]">
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
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={4}
          barCategoryGap="26%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            tick={{ fill: "#64748B", fontSize: 11 }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={64}
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickFormatter={(val: number) => formatBRLCompact(Math.round(val * 100))}
          />
          <Tooltip
            content={<ExecutiveTooltip />}
            cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: "11px", color: "#64748B" }}
          />
          <Bar
            dataKey="received"
            name="Recebido"
            fill="#0F172A"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="costsAndTaxes"
            name="Custos + Impostos"
            fill="#CBD5E1"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="netProfit"
            name="Lucro Líquido"
            fill="#059669"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
