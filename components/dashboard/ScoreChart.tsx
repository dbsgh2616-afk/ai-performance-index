"use client";

// Design Ref: §4.4 월별 지수 그래프 (1~12월, 서비스 6개 누적 막대)
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2"];

export type ChartRow = { month: string } & Record<string, number | string | null>;

export function ScoreChart({ rows, serviceNames }: { rows: ChartRow[]; serviceNames: string[] }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-lg font-bold">월별 지수 그래프</figcaption>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value: number) => value.toLocaleString("ko-KR")} width={72} />
            <Tooltip formatter={(value) => Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} />
            <Legend />
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
