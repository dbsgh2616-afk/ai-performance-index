// Design Ref: §4.4 대시보드 — 요약 카드, 서비스 순위, 월별 그래프, 서비스×월 표, 설문 정보, 근거 등급 배지, "데이터 없음", 증적자료 바로가기
// DB를 모르는 화면 부품이다. 계산 결과(YearScore)와 설정값만 받아서 보여준다.
import Link from "next/link";
import type { ReactNode } from "react";

import { InfraCockpit } from "./InfraCockpit";

import { changeRate, formatMonthLabel, formatPercent, formatScore, NO_DATA } from "@/lib/format";
import type { InfraSnapshot } from "@/lib/infra";
import { spaceEvents, type SpaceEvent, type SpaceEventKind } from "@/lib/score/events";
import type { ServiceStatus, ServiceStatusKind } from "@/lib/score/status";
import { rankServices, type EvidenceGrade, type MonthScore, type ScoreSetting, type YearScore } from "@/lib/score";
import {
  aggregationLabel,
  formatRespondents,
  formatResponseRate,
  formatSurveyPeriod,
  NOT_RECORDED,
  responseRate,
} from "@/lib/survey";

type Props = {
  yearScore: YearScore;
  settings: ScoreSetting[];
  serviceNames: Record<number, string>;
  focusMonth: string; // 카드에 보여줄 달 (예: 2026-11)
  focusLabel: string; // "이번 달" 또는 "12월"
  isAdmin: boolean;
  chart?: ReactNode;
  statuses?: ServiceStatus[]; // 서비스 상태등. 없으면 카드를 그리지 않는다.
  infra?: InfraSnapshot | null; // AI 인프라 계기판. undefined면 카드를 그리지 않고, null이면 "데이터 없음"으로 그린다.
};

// 유리 질감 카드. 색은 포인트에만 쓴다. (app/globals.css의 glass 유틸리티)
const cardClass = "glass rounded-3xl p-6";

// 카드 위쪽의 작은 영문 라벨 (예: 01 / RANKING)
function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">{children}</p>;
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

// 전월 대비 증감 표시. 오르면 시안 ▲, 내리면 핑크 ▼. 비교할 전월 값이 없으면 아무것도 그리지 않는다.
function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  const rate = changeRate(current, previous);
  if (rate === null) return null;
  const text = Math.abs(rate).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  // 소수 첫째 자리까지 봐서 0.0%이면 변화 없음으로 본다.
  const flat = text === "0";
  const up = rate > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
        flat ? "bg-white/10 text-zinc-400" : up ? "bg-cyan-400/15 text-cyan-300" : "bg-pink-500/15 text-pink-300"
      }`}
      title="전월 대비"
    >
      {flat ? "–" : up ? "▲" : "▼"} {text}%
    </span>
  );
}

const STATUS_STYLE: Record<ServiceStatusKind, { label: string; dot: string; text: string }> = {
  done: { label: "교신 완료", dot: "bg-cyan-300 shadow-[0_0_12px_#67e8f9]", text: "text-cyan-300" },
  pending: { label: "교신 대기", dot: "bg-amber-300 shadow-[0_0_12px_#fcd34d] animate-pulse", text: "text-amber-300" },
  unverified: { label: "신호 불명 (근거 미확인)", dot: "bg-pink-400 shadow-[0_0_12px_#f472b6]", text: "text-pink-300" },
};

const SATELLITE_RADIUS = 88; // px

// 서비스별 상태등: 행성 둘레를 도는 위성으로 그린다. 이번 달 누가 자료를 보냈는지(교신) 한눈에 보여 준다.
function StatusStrip({ statuses, focusLabel }: { statuses: ServiceStatus[]; focusLabel: string }) {
  const doneCount = statuses.filter((status) => status.kind === "done").length;

  return (
    <section aria-label="서비스 상태등" className={`${cardClass} flex h-full flex-col gap-5`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Eyebrow>Satellite link</Eyebrow>
          <h2 className="mt-1 text-lg font-bold">서비스 상태등</h2>
          <p className="text-xs text-zinc-500">{focusLabel} 기준 교신 상황입니다. 위성 하나가 서비스 하나입니다.</p>
        </div>
        <p className="font-mono text-sm text-zinc-300">
          <span className="text-2xl font-bold text-white">{doneCount}</span> / {statuses.length} 교신 완료
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* 궤도 그림: 가운데 행성, 둘레를 천천히 도는 위성 */}
        <div className="relative h-56 w-56 shrink-0" aria-hidden>
          <div className="absolute inset-[72px] rounded-full bg-[radial-gradient(circle_at_32%_30%,#f5d0fe,#a855f7_45%,#2e1065_82%)] shadow-[0_0_40px_rgba(168,85,247,0.55)]" />
          <div className="absolute inset-3 rounded-full border border-white/15" />
          <div className="absolute inset-0 rounded-full border border-dashed border-white/10" />
          <div className="orbit-spin absolute inset-0 animate-[orbit-spin_60s_linear_infinite]">
            {statuses.map((status, index) => (
              <span
                key={status.serviceId}
                className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4"
                style={{ transform: `rotate(${(360 / statuses.length) * index}deg) translateY(-${SATELLITE_RADIUS}px)` }}
              >
                <span className={`block h-4 w-4 rounded-full ${STATUS_STYLE[status.kind].dot}`} />
              </span>
            ))}
          </div>
        </div>

        <ul className="grid w-full flex-1 gap-2">
          {statuses.map((status) => {
            const style = STATUS_STYLE[status.kind];
            return (
              <li key={status.serviceId} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                    {status.serviceName}
                    <span className={`text-xs ${style.text}`}>{style.label}</span>
                  </p>
                  {status.reasons.length > 0 && <p className="text-[11px] text-zinc-500">{status.reasons.join(" · ")}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const EVENT_GLYPH: Record<SpaceEventKind, { glyph: string; color: string }> = {
  record: { glyph: "★", color: "text-amber-300 bg-amber-300/15" },
  "service-record": { glyph: "✦", color: "text-fuchsia-300 bg-fuchsia-400/15" },
  surge: { glyph: "☄", color: "text-cyan-300 bg-cyan-300/15" },
  milestone: { glyph: "◎", color: "text-violet-300 bg-violet-400/15" },
  "rank-up": { glyph: "▲", color: "text-emerald-300 bg-emerald-300/15" },
  incident: { glyph: "!", color: "text-rose-300 bg-rose-400/15" },
};

// 우주 이벤트: 이번 달에 생긴 눈에 띄는 일. 신기록이 있으면 유성이 지나간다.
function EventsCard({ events, focusLabel }: { events: SpaceEvent[]; focusLabel: string }) {
  const celebrate = events.some((event) => event.kind === "record" || event.kind === "service-record" || event.kind === "milestone");

  return (
    <section aria-label="우주 이벤트" className={`${cardClass} relative flex h-full flex-col gap-4 overflow-hidden`}>
      {celebrate && (
        <>
          <span className="shooting-star pointer-events-none absolute left-1/2 top-4" aria-hidden />
          <span className="shooting-star pointer-events-none absolute left-3/4 top-10 [animation-delay:2.2s]" aria-hidden />
        </>
      )}
      <div>
        <Eyebrow>Event log</Eyebrow>
        <h2 className="mt-1 text-lg font-bold">우주 이벤트</h2>
        <p className="text-xs text-zinc-500">{focusLabel}에 감지된 소식입니다.</p>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-zinc-500">잔잔한 우주입니다. 이번 달은 특별한 이벤트가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const glyph = EVENT_GLYPH[event.kind];
            return (
              <li key={`${event.kind}-${event.title}`} className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${glyph.color}`} aria-hidden>
                  {glyph.glyph}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{event.title}</p>
                  <p className="text-xs text-zinc-400">{event.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SummaryCards({
  yearScore,
  focus,
  focusLabel,
  previous,
}: {
  yearScore: YearScore;
  focus: MonthScore;
  focusLabel: string;
  previous: MonthScore | undefined;
}) {
  const ranking = rankServices(yearScore);
  const top = ranking[0]?.rank === 1 ? ranking[0] : undefined;
  const share = yearScore.surveyShare;

  return (
    <section aria-label="요약" className="grid gap-4 lg:grid-cols-5">
      <div className="gradient-border relative flex flex-col justify-center overflow-hidden rounded-3xl p-8 lg:col-span-3">
        {/* 장식: 행성과 그 둘레를 도는 위성. 넓은 화면에서만 보인다. */}
        <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-72 w-72 -translate-y-1/2 xl:block" aria-hidden>
          <div className="absolute inset-12 rounded-full bg-[radial-gradient(circle_at_32%_30%,#f5d0fe,#a855f7_45%,#2e1065_82%)] shadow-[0_0_70px_rgba(168,85,247,0.55)]" />
          <div className="absolute inset-4 rounded-full border border-white/15" />
          <div className="absolute -inset-4 rounded-full border border-dashed border-white/10" />
          <div className="orbit-spin absolute inset-4 animate-[orbit-spin_24s_linear_infinite]">
            <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
          </div>
        </div>
        <Eyebrow>Annual index</Eyebrow>
        <p className="mt-1 text-sm font-medium text-zinc-300">{yearScore.year}년 연간 누적 지수</p>
        <p className="neon-text mt-4 font-mono text-6xl font-bold tabular-nums tracking-tighter sm:text-7xl">
          {formatScore(yearScore.countedMonths.length === 0 ? null : yearScore.annualTotal)}
        </p>
        <p className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded-full border border-white/10 px-3 py-1">{yearScore.countedMonths.length}개월 합산</span>
          {top && (
            <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 font-medium text-fuchsia-200">
              1위 {top.serviceName}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:col-span-2">
        <div className={cardClass}>
          <Eyebrow>Current cycle</Eyebrow>
          <p className="mt-1 text-sm font-medium text-zinc-300">{focusLabel} 합계</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-white">{formatScore(focus.total)}</p>
            <Delta current={focus.total} previous={previous?.total ?? null} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{monthNote(focus) ?? "서비스 6개 모두 계산됨"}</p>
        </div>

        <div className={cardClass}>
          <Eyebrow>Signal source</Eyebrow>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="text-sm font-medium text-zinc-300">설문 추정 비중</p>
            <p className="font-mono text-3xl font-bold tabular-nums text-pink-300">{formatPercent(share)}</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${share ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">호출횟수(실측), 업무절감시간·업무기여도(설문 추정) 중 설문 값의 비율</p>
        </div>
      </div>
    </section>
  );
}

function RankingCard({ yearScore }: { yearScore: YearScore }) {
  const ranking = rankServices(yearScore);

  return (
    <section aria-label="서비스 순위" className={`${cardClass} flex h-full flex-col gap-5`}>
      <div>
        <Eyebrow>01 / Orbit rank</Eyebrow>
        <h2 className="mt-1 text-lg font-bold">서비스 순위</h2>
        <p className="text-xs text-zinc-500">{yearScore.year}년 연간 누적 점수 기준 (점수가 계산된 달의 합)</p>
      </div>
      <ol className="flex flex-col gap-4">
        {ranking.map((row) => {
          const first = row.rank === 1;
          return (
            <li key={row.serviceId} className="flex items-center gap-4">
              <span
                className={`w-7 shrink-0 text-center font-mono text-2xl font-bold tabular-nums ${
                  first ? "neon-text" : "text-zinc-600"
                }`}
                aria-label={row.rank === null ? "순위 없음" : `${row.rank}위`}
              >
                {row.rank ?? "-"}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${first ? "font-bold text-white" : "font-medium text-zinc-300"}`}>
                    {row.serviceName}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-zinc-300">
                    {row.rank === null ? NO_DATA : formatScore(row.annualScore)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className={`h-full rounded-full ${first ? "bg-gradient-to-r from-violet-500 to-pink-500" : "bg-violet-400/50"}`}
                    style={{ width: `${row.barPercent}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GradeDot({ grade, label }: { grade: EvidenceGrade | null; label: string }) {
  if (!grade) return null;
  const color = grade === "실측" ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" : "bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.9)]";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} title={`${label}: ${grade}`} />;
}

function MonthlyTable({ focus, focusLabel, previous }: { focus: MonthScore; focusLabel: string; previous: MonthScore | undefined }) {
  const hasData = focus.services.some((service) => service.callCount !== null);
  // 막대 길이는 그 달에서 가장 높은 서비스를 100%로 본다.
  const maxScore = Math.max(1, ...focus.services.map((service) => service.score ?? 0));

  return (
    <section aria-label="서비스별 월 지수" className={`${cardClass} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Eyebrow>03 / Telemetry</Eyebrow>
          <h2 className="mt-1 text-lg font-bold">서비스별 월 지수</h2>
          <p className="text-xs text-zinc-500">
            {focusLabel === formatMonthLabel(focus.yearMonth) ? focusLabel : `${focusLabel} · ${formatMonthLabel(focus.yearMonth)}`} 기준
          </p>
        </div>
        <p className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <GradeDot grade="실측" label="범례" />
            실측
          </span>
          <span className="flex items-center gap-1.5">
            <GradeDot grade="설문 추정" label="범례" />
            설문
          </span>
        </p>
      </div>

      {!hasData ? (
        <p className="text-sm text-zinc-500">{NO_DATA} — 이 달에 입력된 값이 없습니다.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {focus.services.map((service, index) => (
              <li key={service.serviceId} className="grid grid-cols-[8rem_1fr_auto] items-center gap-4">
                <span className="flex items-center gap-2 truncate text-sm font-medium text-zinc-200">
                  {service.serviceName}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                    style={{ width: `${service.score === null ? 0 : (service.score / maxScore) * 100}%` }}
                  />
                </div>
                <span className="flex min-w-[13rem] items-center justify-end gap-2 font-mono text-sm tabular-nums">
                  {service.score === null ? (
                    <span className="text-xs text-zinc-500">{NO_DATA}</span>
                  ) : (
                    <>
                      <Delta current={service.score} previous={previous?.services[index]?.score ?? null} />
                      <GradeDot grade={service.grades.callCount} label="호출횟수" />
                      <GradeDot grade={service.grades.setting} label="업무절감시간·업무기여도" />
                      <span className="w-20 text-right font-semibold text-white">{formatScore(service.score)}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="font-bold">합계</span>
            {focus.total === null ? (
              <span className="text-sm text-zinc-500">{NO_DATA}</span>
            ) : (
              <span className="flex items-center gap-3">
                {focus.penaltyApplied && (
                  <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-300">보안사고 -50%</span>
                )}
                <span className="neon-text font-mono text-2xl font-bold tabular-nums">{formatScore(focus.total)}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">서비스 6개가 모두 계산된 달만 합계를 냅니다.</p>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/60 px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-lg font-bold tabular-nums">
        {value.toLocaleString("ko-KR")}
        <span className="ml-0.5 text-xs font-normal text-zinc-400">{unit}</span>
      </p>
    </div>
  );
}

function SurveyHalf({ row }: { row: ScoreSetting }) {
  const respondents = row.survey?.respondentCount ?? null;
  const target = row.survey?.targetCount ?? null;
  const rate = responseRate(respondents, target);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-bold text-pink-300">
          {row.half === "H1" ? "상반기" : "하반기"}
        </span>
        <span className="text-xs text-zinc-400">
          {row.survey?.aggregation ? aggregationLabel(row.survey.aggregation) : NOT_RECORDED}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{formatResponseRate(respondents, target)}</span>
          <span className="text-xs text-zinc-400">{formatRespondents(respondents, target)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-400 shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{ width: `${Math.min(100, rate ?? 0)}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          응답률 · {formatSurveyPeriod(row.survey?.surveyStart ?? null, row.survey?.surveyEnd ?? null)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="업무절감시간" value={row.savedMinutes} unit="분/건" />
        <Metric label="업무기여도" value={row.contributionPct} unit="%" />
      </div>
    </div>
  );
}

function SurveyTable({ settings, serviceNames }: { settings: ScoreSetting[]; serviceNames: Record<number, string> }) {
  const sorted = [...settings].sort((a, b) => a.serviceId - b.serviceId || a.half.localeCompare(b.half));
  const serviceIds = [...new Set(sorted.map((row) => row.serviceId))];

  return (
    <section aria-label="설문 정보" className={`${cardClass} flex flex-col gap-4`}>
      <div>
        <Eyebrow>04 / Field survey</Eyebrow>
        <h2 className="mt-1 text-lg font-bold">설문 정보</h2>
        <p className="text-xs text-zinc-500">업무절감시간·업무기여도가 어떤 조사에서 나왔는지 보여주는 근거입니다.</p>
      </div>
      {serviceIds.length === 0 ? (
        <p className="text-sm text-zinc-500">{NO_DATA} — 입력된 설문 설정값이 없습니다.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {serviceIds.map((id) => (
            <article key={id} className="flex flex-col gap-3 rounded-2xl border border-white/10 p-4">
              <h3 className="font-bold">{serviceNames[id] ?? id}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {sorted
                  .filter((row) => row.serviceId === id)
                  .map((row) => (
                    <SurveyHalf key={row.half} row={row} />
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function DashboardView({ yearScore, settings, serviceNames, focusMonth, focusLabel, isAdmin, chart, statuses, infra }: Props) {
  const found = yearScore.months.findIndex((month) => month.yearMonth === focusMonth);
  const focusIndex = found === -1 ? 11 : found;
  const focus = yearScore.months[focusIndex];
  // 전월 대비 비교용. 1월은 작년 12월 데이터가 이 화면에 없어서 비교하지 않는다.
  const previous = yearScore.months[focusIndex - 1];
  const events = spaceEvents(yearScore, focus.yearMonth);

  return (
    <div className="flex flex-col gap-6">
      {/* 메인: 월별 AI 지수 선그래프. 맨 위에 가장 크게 둔다. */}
      <div className="gradient-border rounded-3xl p-6 sm:p-8">{chart}</div>

      <SummaryCards yearScore={yearScore} focus={focus} focusLabel={focusLabel} previous={previous} />

      {infra !== undefined && <InfraCockpit snapshot={infra} yearMonth={focus.yearMonth} isAdmin={isAdmin} />}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <RankingCard yearScore={yearScore} />
        </div>
        <div className="lg:col-span-3">
          <MonthlyTable focus={focus} focusLabel={focusLabel} previous={previous} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {statuses && (
          <div className="lg:col-span-3">
            <StatusStrip statuses={statuses} focusLabel={focusLabel} />
          </div>
        )}
        <div className={statuses ? "lg:col-span-2" : "lg:col-span-5"}>
          <EventsCard events={events} focusLabel={focusLabel} />
        </div>
      </div>

      {isAdmin && (
        <p className="text-sm">
          <Link href={`/evidence?year=${yearScore.year}`} className="font-medium text-fuchsia-400 underline underline-offset-4 hover:text-fuchsia-300">
            증적자료 출력 바로가기 →
          </Link>
        </p>
      )}

      <SurveyTable settings={settings} serviceNames={serviceNames} />
    </div>
  );
}
