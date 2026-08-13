"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { CATEGORY_LABELS } from "@/lib/labels";

const COLORS = ["#D62828", "#F77F00", "#003049", "#FECE32", "#2a5a72"];

export function CategoryDonut({
  data,
}: {
  data: { category: string; count: number }[];
}) {
  const chart = data.map((d) => ({
    name: CATEGORY_LABELS[d.category] || d.category,
    value: d.count,
  }));
  const total = chart.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chart}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
          >
            {chart.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold text-[var(--axon-navy)]">{total}</div>
          <div className="text-xs text-slate-400">{"\u4e8b\u4ef6"}</div>
        </div>
      </div>
    </div>
  );
}

export function TrendLine({
  data,
}: {
  data: { date: string; created: number; closed: number }[];
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,48,73,0.1)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#2a5a72" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#2a5a72" }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="created" name="新增" stroke="#F77F00" strokeWidth={2} />
          <Line type="monotone" dataKey="closed" name="完成" stroke="#003049" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
