// Design Ref: §4.4 대시보드 — 요약 카드, 서비스 순위, 월별 그래프, 서비스×월 표, 설문 정보, 근거 등급 배지, "데이터 없음", 증적자료 바로가기
// DB를 모르는 화면 부품이다. 계산 결과(YearScore)와 설정값만 받아서 보여준다.
import Link from "next/link";
import type { ReactNode } from "react";

import { formatMonthLabel, formatPercent, formatScore, NO_DATA } from "@/lib/format";
import { rankServices, type EvidenceGrade, type MonthScore, type ScoreSetting, type YearScore } from "@/lib/score";
import {
  aggregationLabel,
  formatRespondents,
  formatResponseRate,
  formatSurveyPeriod,
  NOT_RECORDED,
} from "@/lib/survey";

type Props = {
  yearScore: YearScore;
  settings: ScoreSetting[];
  serviceNames: Record<number, string>;
  focusMonth: string; // 카드에 보여줄 달 (예: 2026-11)
  focusLabel: string; // "이번 달" 또는 "12월"
  isAdmin: boolean;
  chart?: ReactNode;
};

const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function GradeBadge({ grade, label }: { grade: EvidenceGrade | null; label: string }) {
  if (!grade) return null;
  const style =
    grade === "실측"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${style}`} title={`${label}: ${grade}`}>
      {grade === "실측" ? "실측" : "설문"}
    </span>
  );
}

function monthNote(month: MonthScore): string | undefined {
  if (month.total === null) {
    return `서비스 ${month.services.length - month.missingServiceCount}/${month.services.length}개 입력됨`;
  }
  if (month.penaltyApplied) {
    return `보안사고로 50% 감점 적용 (감점 전 ${formatScore(month.rawTotal)})`;
  }
  return undefined;
}

function SummaryCards({ yearScore, focus, focusLabel }: { yearScore: YearScore; focus: MonthScore; focusLabel: string }) {
  const ranking = rankServices(yearScore);
  const top = ranking[0]?.rank === 1 ? ranking[0] : undefined;
  const share = yearScore.surveyShare;

  return (
    <section aria-label="요약" className="grid gap-4 md:grid-cols-3">
      <div className={`${cardClass} border-l-4 border-l-indigo-500`}>
        <p className="text-sm font-medium text-zinc-500">{yearScore.year}년 연간 누적 지수</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
          {formatScore(yearScore.countedMonths.length === 0 ? null : yearScore.annualTotal)}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {yearScore.countedMonths.length}개월 합산{top ? ` · 1위 ${top.serviceName}` : ""}
        </p>
      </div>

      <div className={`${cardClass} border-l-4 border-l-sky-500`}>
        <p className="text-sm font-medium text-zinc-500">{focusLabel} 합계</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">{formatScore(focus.total)}</p>
        <p className="mt-2 text-xs text-zinc-500">{monthNote(focus) ?? "서비스 6개 모두 계산됨"}</p>
      </div>

      <div className={`${cardClass} border-l-4 border-l-amber-500`}>
        <p className="text-sm font-medium text-zinc-500">설문 추정 비중</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">{formatPercent(share)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${share ?? 0}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">호출횟수(실측), 업무절감시간·업무기여도(설문 추정) 중 설문 값의 비율</p>
      </div>
    </section>
  );
}

const RANK_STYLES = [
  "bg-amber-400 text-amber-950",
  "bg-zinc-300 text-zinc-800",
  "bg-orange-300 text-orange-950",
];

function RankingCard({ yearScore }: { yearScore: YearScore }) {
  const ranking = rankServices(yearScore);

  return (
    <section aria-label="서비스 순위" className={`${cardClass} flex flex-col gap-4`}>
      <div>
        <h2 className="text-lg font-bold">서비스 순위</h2>
        <p className="text-xs text-zinc-500">{yearScore.year}년 연간 누적 점수 기준 (점수가 계산된 달의 합)</p>
      </div>
      <ol className="flex flex-col gap-3">
        {ranking.map((row) => (
          <li key={row.serviceId} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                row.rank !== null && row.rank <= 3 ? RANK_STYLES[row.rank - 1] : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
              aria-label={row.rank === null ? "순위 없음" : `${row.rank}위`}
            >
              {row.rank ?? "-"}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{row.serviceName}</span>
                <span className="text-sm font-bold tabular-nums">{row.rank === null ? NO_DATA : formatScore(row.annualScore)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.barPercent}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MonthlyTable({ yearScore }: { yearScore: YearScore }) {
  // 입력이 있는 달만 칸으로 보여준다. 빈 달이 표를 가득 채우지 않게 한다.
  const activeMonths = yearScore.months.filter((month) => month.services.some((service) => service.callCount !== null));
  const emptyMonths = yearScore.months.filter((month) => !activeMonths.includes(month));
  const services = yearScore.months[0].services;

  return (
    <section aria-label="서비스×월 표" className={`${cardClass} flex flex-col gap-3`}>
      <h2 className="text-lg font-bold">서비스별 월 지수</h2>
      {activeMonths.length === 0 ? (
        <p className="text-sm text-zinc-500">{NO_DATA} — 아직 입력된 달이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="sticky left-0 bg-white py-2 pr-3 font-medium dark:bg-zinc-900">서비스</th>
                {activeMonths.map((month) => (
                  <th key={month.yearMonth} className="px-2 py-2 text-right font-medium">
                    {formatMonthLabel(month.yearMonth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={service.serviceId} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="sticky left-0 bg-white py-2.5 pr-3 font-medium dark:bg-zinc-900">{service.serviceName}</td>
                  {activeMonths.map((month) => {
                    const cell = month.services[index];
                    return (
                      <td key={month.yearMonth} className="px-2 py-2.5 text-right align-top">
                        {cell.score === null ? (
                          <span className="text-xs text-zinc-400">{NO_DATA}</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span>{formatScore(cell.score)}</span>
                            <span className="flex gap-1">
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
              <tr className="bg-zinc-50 font-bold dark:bg-zinc-800">
                <td className="sticky left-0 bg-zinc-50 py-2.5 pr-3 dark:bg-zinc-800">합계</td>
                {activeMonths.map((month) => (
                  <td key={month.yearMonth} className="px-2 py-2.5 text-right align-top">
                    {month.total === null ? (
                      <span className="text-xs font-normal text-zinc-400">{NO_DATA}</span>
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
      )}
      <p className="text-xs text-zinc-500">
        {emptyMonths.length > 0 && <>입력이 없는 달: {emptyMonths.map((month) => formatMonthLabel(month.yearMonth)).join(", ")}. </>}
        근거 등급: <GradeBadge grade="실측" label="범례" /> 호출횟수 · <GradeBadge grade="설문 추정" label="범례" /> 업무절감시간·업무기여도.
        서비스 6개가 모두 계산된 달만 합계를 냅니다.
      </p>
    </section>
  );
}

function SurveyTable({ settings, serviceNames }: { settings: ScoreSetting[]; serviceNames: Record<number, string> }) {
  const rows = [...settings].sort((a, b) => a.serviceId - b.serviceId || a.half.localeCompare(b.half));

  return (
    <section aria-label="설문 정보" className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="text-lg font-bold">설문 정보</h2>
        <p className="text-xs text-zinc-500">업무절감시간·업무기여도가 어떤 조사에서 나왔는지 보여주는 근거입니다.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{NO_DATA} — 입력된 설문 설정값이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3 font-medium">서비스</th>
                <th className="py-2 pr-3 font-medium">반기</th>
                <th className="py-2 pr-3 font-medium">응답자 / 대상</th>
                <th className="py-2 pr-3 text-right font-medium">응답률</th>
                <th className="py-2 pr-3 font-medium">조사 기간</th>
                <th className="py-2 pr-3 font-medium">집계 방식</th>
                <th className="py-2 pr-3 text-right font-medium">절감시간(분)</th>
                <th className="py-2 text-right font-medium">기여도(%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.serviceId}-${row.half}`} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2.5 pr-3 font-medium">{serviceNames[row.serviceId] ?? row.serviceId}</td>
                  <td className="py-2.5 pr-3">{row.half === "H1" ? "상반기" : "하반기"}</td>
                  <td className="py-2.5 pr-3">{formatRespondents(row.survey?.respondentCount ?? null, row.survey?.targetCount ?? null)}</td>
                  <td className="py-2.5 pr-3 text-right">{formatResponseRate(row.survey?.respondentCount ?? null, row.survey?.targetCount ?? null)}</td>
                  <td className="py-2.5 pr-3">{formatSurveyPeriod(row.survey?.surveyStart ?? null, row.survey?.surveyEnd ?? null)}</td>
                  <td className="py-2.5 pr-3">{row.survey?.aggregation ? aggregationLabel(row.survey.aggregation) : NOT_RECORDED}</td>
                  <td className="py-2.5 pr-3 text-right">{row.savedMinutes}</td>
                  <td className="py-2.5 text-right">{row.contributionPct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DashboardView({ yearScore, settings, serviceNames, focusMonth, focusLabel, isAdmin, chart }: Props) {
  const focus = yearScore.months.find((month) => month.yearMonth === focusMonth) ?? yearScore.months[11];

  return (
    <div className="flex flex-col gap-6">
      <SummaryCards yearScore={yearScore} focus={focus} focusLabel={focusLabel} />

      {isAdmin && (
        <p className="text-sm">
          <Link href={`/evidence?year=${yearScore.year}`} className="font-medium text-indigo-600 underline underline-offset-4 dark:text-indigo-400">
            증적자료 출력 바로가기 →
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <RankingCard yearScore={yearScore} />
        </div>
        <div className="lg:col-span-3">
          <div className={`${cardClass} h-full`}>{chart}</div>
        </div>
      </div>

      <MonthlyTable yearScore={yearScore} />
      <SurveyTable settings={settings} serviceNames={serviceNames} />
    </div>
  );
}
