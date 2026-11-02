"use client";

// Design Ref: §4.4 월별 지수 그래프 (1~12월, 서비스 6개 누적 막대) — 어두운 화면에 맞는 색을 쓴다.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];
const TEXT = "#a1a1aa";

export type ChartRow = { month: string } & Record<string, number | string | null>;

export function ScoreChart({ rows, serviceNames }: { rows: ChartRow[]; serviceNames: string[] }) {
  return (
    <figure className="flex h-full flex-col gap-2">
      <figcaption className="text-lg font-bold">월별 지수 그래프</figcaption>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: TEXT, fontSize: 12 }} stroke="#3f3f46" />
            <YAxis
              tick={{ fill: TEXT, fontSize: 12 }}
              stroke="#3f3f46"
              tickFormatter={(value: number) => value.toLocaleString("ko-KR")}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#e4e4e7" }}
              labelStyle={{ color: "#e4e4e7" }}
              formatter={(value) => Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
            />
            <Legend wrapperStyle={{ color: TEXT, fontSize: 12 }} formatter={(value) => <span style={{ color: TEXT }}>{value}</span>} />
            {serviceNames.map((name, index) => (
              <Bar key={name} dataKey={name} stackId="services" fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-500">
        서비스별 점수를 쌓은 막대입니다. 입력이 없는 서비스는 그리지 않으며, 표의 합계는 6개가 모두 계산된 달만 나옵니다.
        보안사고 감점은 표의 합계에만 반영됩니다.
      </p>
    </figure>
  );
}
