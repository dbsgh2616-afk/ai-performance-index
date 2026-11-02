// Design Ref: §4.4 대시보드 (`/`) — 관리자와 조회자 모두 볼 수 있다.
// 지수는 항상 현재 저장된 값으로 계산한다. (값이 늦게 들어오거나 바뀌면 과거 달 지수도 바뀐다)
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/DashboardView";
import { ScoreChart, type ChartRow } from "@/components/dashboard/ScoreChart";
import { requireUser } from "@/lib/auth/guard";
import { currentYear, currentYearMonth } from "@/lib/date";
import { getDb } from "@/lib/db";
import { formatMonthLabel } from "@/lib/format";
import { calculateYear } from "@/lib/score";
import { loadScoreData } from "@/lib/score/load";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await requireUser();

  const params = await searchParams;
  const yearParam = typeof params.year === "string" ? Number(params.year) : NaN;
  const nowYear = currentYear();
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2099 ? yearParam : nowYear;

  const data = await loadScoreData(getDb(), year);
  const yearScore = calculateYear(data);

  // 올해는 이번 달, 다른 해는 12월을 카드에 보여준다.
  const focusMonth = year === nowYear ? currentYearMonth() : `${year}-12`;
  const focusLabel = year === nowYear ? "이번 달" : formatMonthLabel(focusMonth);

  const chartRows: ChartRow[] = yearScore.months.map((month) => {
    const row: ChartRow = { month: formatMonthLabel(month.yearMonth) };
    for (const service of month.services) row[service.serviceName] = service.score;
    return row;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            연도
            <input
              type="number"
              name="year"
              min={2000}
              max={2099}
              defaultValue={year}
              className="w-28 rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
            />
          </label>
          <button type="submit" className="rounded border border-zinc-400 px-3 py-2 text-sm">
            보기
          </button>
        </form>
      </div>

      <DashboardView
        yearScore={yearScore}
        focusMonth={focusMonth}
        focusLabel={focusLabel}
        isAdmin={user.role === "admin"}
      />
      <ScoreChart rows={chartRows} serviceNames={data.services.map((service) => service.name)} />
    </div>
  );
}
