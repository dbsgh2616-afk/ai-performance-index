// Design Ref: §4.4 대시보드 (`/`) — 관리자와 조회자 모두 볼 수 있다.
// 지수는 항상 현재 저장된 값으로 계산한다. (값이 늦게 들어오거나 바뀌면 과거 달 지수도 바뀐다)
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/DashboardView";
import { ScoreChart, type GaugeMonth } from "@/components/dashboard/ScoreChart";
import { requireUser } from "@/lib/auth/guard";
import { currentYear, currentYearMonth } from "@/lib/date";
import { getDb } from "@/lib/db";
import { formatMonthLabel } from "@/lib/format";
import { calculateYear } from "@/lib/score";
import { loadScoreData } from "@/lib/score/load";
import { serviceStatuses } from "@/lib/score/status";

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

  const focusScore = yearScore.months.find((month) => month.yearMonth === focusMonth) ?? yearScore.months[11];
  const statuses = serviceStatuses(data, focusScore);

  const gaugeMonths: GaugeMonth[] = yearScore.months.map((month) => ({
    label: formatMonthLabel(month.yearMonth),
    total: month.total,
    penalty: month.penaltyApplied,
    isFocus: month.yearMonth === focusMonth,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">AI mission control · performance index</p>
          <h1 className="neon-text mt-1 text-4xl font-bold tracking-tight">대시보드</h1>
        </div>
        <form method="get" className="glass flex items-center gap-1 rounded-full p-1 pl-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            연도
            <input
              type="number"
              name="year"
              min={2000}
              max={2099}
              defaultValue={year}
              className="w-20 bg-transparent font-mono text-base font-bold text-white outline-none"
            />
          </label>
          <button type="submit" className="rounded-full bg-fuchsia-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-400">
            보기
          </button>
        </form>
      </div>

      <DashboardView
        yearScore={yearScore}
        settings={data.settings}
        serviceNames={Object.fromEntries(data.services.map((service) => [service.id, service.name]))}
        focusMonth={focusMonth}
        focusLabel={focusLabel}
        isAdmin={user.role === "admin"}
        chart={<ScoreChart months={gaugeMonths} />}
        statuses={statuses}
      />
    </div>
  );
}
