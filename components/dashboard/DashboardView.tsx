// Design Ref: §4.4 대시보드 — 카드, 서비스×월 표, 근거 등급 배지, "데이터 없음", 증적자료 바로가기
// DB를 모르는 화면 부품이다. 계산 결과(YearScore)만 받아서 보여준다.
import Link from "next/link";

import { formatMonthLabel, formatPercent, formatScore, NO_DATA } from "@/lib/format";
import type { EvidenceGrade, MonthScore, YearScore } from "@/lib/score";

type Props = {
  yearScore: YearScore;
  focusMonth: string; // 카드에 보여줄 달 (예: 2026-11)
  focusLabel: string; // "이번 달" 또는 "12월"
  isAdmin: boolean;
};

function GradeBadge({ grade, label }: { grade: EvidenceGrade | null; label: string }) {
  if (!grade) return null;
  const style =
    grade === "실측"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return (
    <span className={`rounded px-1 text-[10px] leading-4 ${style}`} title={`${label}: ${grade}`}>
      {grade === "실측" ? "실측" : "설문"}
    </span>
  );
}

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

function monthCardNote(month: MonthScore): string | undefined {
  if (month.total === null) {
    return `서비스 ${month.services.length - month.missingServiceCount}/${month.services.length}개 입력됨`;
  }
  if (month.penaltyApplied) {
    return `보안사고로 50% 감점 적용 (감점 전 ${formatScore(month.rawTotal)})`;
  }
  return undefined;
}

export function DashboardView({ yearScore, focusMonth, focusLabel, isAdmin }: Props) {
  const focus = yearScore.months.find((month) => month.yearMonth === focusMonth) ?? yearScore.months[11];
  const services = yearScore.months[0].services;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="요약" className="grid gap-4 sm:grid-cols-3">
        <Card
          title={`${yearScore.year}년 연간 누적 지수`}
          value={formatScore(yearScore.countedMonths.length === 0 ? null : yearScore.annualTotal)}
          note={`${yearScore.countedMonths.length}개월 합산 · 합계를 내지 못한 달 ${yearScore.missingMonths.length}개`}
        />
        <Card title={`${focusLabel} 합계`} value={formatScore(focus.total)} note={monthCardNote(focus)} />
        <Card
          title="설문 추정 비중"
          value={formatPercent(yearScore.surveyShare)}
          note="산식에 들어간 값(호출횟수, 업무절감시간, 업무기여도) 중 설문 추정 값의 비율"
        />
      </section>

      {isAdmin && (
        <p className="text-sm">
          <Link href={`/evidence?year=${yearScore.year}`} className="underline">
            증적자료 출력 바로가기 →
          </Link>
        </p>
      )}

      <section aria-label="서비스×월 표" className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">서비스별 월 지수</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2 pr-2">서비스</th>
                {yearScore.months.map((month) => (
                  <th key={month.yearMonth} className="px-1 py-2 text-right">
                    {formatMonthLabel(month.yearMonth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={service.serviceId} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-2 font-medium">{service.serviceName}</td>
                  {yearScore.months.map((month) => {
                    const cell = month.services[index];
                    return (
                      <td key={month.yearMonth} className="px-1 py-2 text-right align-top">
                        {cell.score === null ? (
                          <span className="text-zinc-400">{NO_DATA}</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{formatScore(cell.score)}</span>
                            <span className="flex gap-0.5">
                              <GradeBadge grade={cell.grades.callCount} label="호출횟수" />
                              <GradeBadge grade={cell.grades.setting} label="업무절감시간·업무기여도" />
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-400 font-bold dark:border-zinc-500">
                <td className="py-2 pr-2">합계</td>
                {yearScore.months.map((month) => (
                  <td key={month.yearMonth} className="px-1 py-2 text-right align-top">
                    {month.total === null ? (
                      <span className="font-normal text-zinc-400">{NO_DATA}</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{formatScore(month.total)}</span>
                        {month.penaltyApplied && (
                          <span className="text-[10px] font-normal text-red-600 dark:text-red-400">보안사고 -50%</span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          근거 등급: <GradeBadge grade="실측" label="범례" /> 호출횟수(실측) · <GradeBadge grade="설문 추정" label="범례" />{" "}
          업무절감시간·업무기여도(설문 추정). 서비스 6개가 모두 계산된 달만 합계를 냅니다.
        </p>
      </section>
    </div>
  );
}
