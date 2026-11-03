// AI 인프라 계기판 — 화면 하단에 붙어 스크롤을 따라다니는 1인칭 우주선 조종석.
// 가운데는 추정 ROI, 양옆 날개에 비용 계기 4개: GPU 도입비용 · GPU 갯수 · 토큰 사용료 · 월 총비용.
// 계기판 윗면이 앞으로 눕고(원근), 계기와 ROI 패널이 판 위로 떠 있다(깊이). 바깥 계기는 안쪽으로 꺾여 있다.
// 윗줄의 경고등은 그 달 인프라 사용률(GPU·메모리·스토리지)과 가동률로 정한다. 값은 모두 관리자가 직접 입력한 것이다.
// 접기/펴기는 <details>라서 자바스크립트가 필요 없다.
import Link from "next/link";
import type { ReactNode } from "react";

import { changeRate, formatMonthLabel } from "@/lib/format";
import { dialLevel, INFRA_GAUGES, type DialLevel, type InfraSnapshot } from "@/lib/infra";
import { formatWon, type CostBreakdown, type RoiResult } from "@/lib/roi";

const LEVEL_STYLE: Record<DialLevel, { text: string; color: string }> = {
  ok: { text: "text-cyan-300", color: "#22d3ee" },
  warn: { text: "text-amber-300", color: "#fbbf24" },
  danger: { text: "text-rose-300", color: "#fb7185" },
};

const OVERALL_TEXT: Record<DialLevel, string> = {
  ok: "ALL SYSTEMS NOMINAL",
  warn: "MASTER CAUTION",
  danger: "MASTER WARNING",
};

// 하나라도 위험이면 위험, 주의가 있으면 주의, 아니면 정상
function overallLevel(snapshot: InfraSnapshot): DialLevel {
  const levels = INFRA_GAUGES.map((gauge) => dialLevel(gauge.kind, snapshot.values[gauge.key]));
  return levels.includes("danger") ? "danger" : levels.includes("warn") ? "warn" : "ok";
}

// 조종석에 앉은 사람을 감싸도록 계기들이 부채꼴로 놓인다: 바깥쪽일수록 가운데(앉은 사람)를 향해 더 꺾이고(rotateY), 더 앞으로 나와 있으며(translateZ), 곡선을 따라 조금 아래에 놓인다.
const TILT_CLASS = {
  "outer-left": "lg:translate-y-3 lg:[transform:perspective(520px)_translateZ(34px)_rotateY(38deg)]",
  "inner-left": "lg:translate-y-0.5 lg:[transform:perspective(520px)_translateZ(26px)_rotateY(18deg)]",
  "inner-right": "lg:translate-y-0.5 lg:[transform:perspective(520px)_translateZ(26px)_rotateY(-18deg)]",
  "outer-right": "lg:translate-y-3 lg:[transform:perspective(520px)_translateZ(34px)_rotateY(-38deg)]",
} as const;

type Tilt = keyof typeof TILT_CLASS;

const NO_DATA = "데이터 없음";
// 작은 글자 칸에는 만원 단위 숫자만 쓴다. 예: 400 (= 400만원)
const man = (value: number) => Math.round(value / 10_000).toLocaleString("ko-KR");

function Gauge({ label, value, sub, tilt, color, children }: { label: string; value: string; sub?: ReactNode; tilt: Tilt; color: string; children?: ReactNode }) {
  return (
    <li
      className={`flex min-w-0 flex-col items-center justify-between gap-1 rounded-xl border border-cyan-200/25 border-b-black/60 bg-gradient-to-b from-[#161c3d] to-[#070914] px-2 pb-2 pt-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_0_16px_rgba(34,211,238,0.1),0_14px_16px_-6px_rgba(0,0,0,0.85)] ${TILT_CLASS[tilt]}`}
    >
      <p className="max-w-full truncate text-xs font-medium text-zinc-300">{label}</p>
      <p className="max-w-full truncate font-mono text-2xl font-extrabold leading-tight tabular-nums" style={{ color, textShadow: `0 0 12px ${color}88` }}>
        {value}
      </p>
      <div className="flex h-5 w-full items-end justify-center">{children}</div>
      <p className="max-w-full break-keep text-center text-xs leading-tight text-zinc-300">{sub}</p>
    </li>
  );
}

// 가운데 ROI 패널: 이 계기판의 주인공이라 가장 크고 밝게 보여 준다.
function RoiPanel({ roi }: { roi: RoiResult | null }) {
  const positive = roi !== null && roi.roiPct >= 0;
  const color = roi === null ? "#a1a1aa" : positive ? "#34f5d0" : "#fb7185";

  return (
    <li
      className="order-first col-span-2 flex min-w-0 flex-col items-center justify-center rounded-2xl border px-4 py-2 lg:order-none lg:col-span-1 lg:[transform:perspective(600px)_translateZ(18px)]"
      style={{
        borderColor: `${color}99`,
        background: `radial-gradient(120% 140% at 50% 0%, ${color}33, #070914 70%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 34px ${color}55, 0 16px 20px -6px rgba(0,0,0,0.9)`,
      }}
    >
      <p className="text-sm font-bold tracking-wide text-zinc-100">추정 ROI</p>
      {roi === null ? (
        <p className="font-mono text-3xl font-extrabold text-zinc-300">{NO_DATA}</p>
      ) : (
        <>
          <p className="font-mono text-5xl font-extrabold tabular-nums leading-none" style={{ color, textShadow: `0 0 12px ${color}, 0 0 34px ${color}aa` }}>
            {positive ? "+" : ""}
            {roi.roiPct.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%
          </p>
          <p className="mt-1 text-xs text-zinc-200">
            효과 {formatWon(roi.benefit)} · 비용 {formatWon(roi.cost)}
          </p>
        </>
      )}
    </li>
  );
}

export function InfraCockpit({
  snapshot,
  yearMonth,
  isAdmin,
  roi,
  costs,
  tokenSeries = [],
}: {
  snapshot: InfraSnapshot | null;
  yearMonth: string;
  isAdmin: boolean;
  roi: RoiResult | null;
  costs: CostBreakdown | null;
  tokenSeries?: number[]; // 1월부터 선택한 달까지 월별 토큰 사용료(원). 마지막이 선택한 달
}) {
  const overall = snapshot ? overallLevel(snapshot) : null;
  const overallStyle = overall ? LEVEL_STYLE[overall] : null;

  // 토큰 사용료: 이번 달 값과 전월 대비
  const token = snapshot ? snapshot.tokenCost : null;
  const previousToken = tokenSeries.length >= 2 ? tokenSeries[tokenSeries.length - 2] : null;
  const tokenChange = token !== null ? changeRate(token, previousToken) : null;
  const tokenMax = Math.max(1, ...tokenSeries);
  const monthlyTotal = costs && token !== null ? costs.amortMonthly + costs.opexMonthly + token : null;
  const gpuShare = costs && costs.capexTotal > 0 ? Math.round((costs.gpuCapex / costs.capexTotal) * 100) : null;
  const gpuCount = costs?.gpuCount;

  return (
    <>
      {/* 앞유리 양옆 기둥: 내용 뒤에 깔려 카드가 가려지지 않는다. 넓은 화면에서만 보인다. */}
      <span className="cockpit-pillar cockpit-pillar-left hidden xl:block" aria-hidden />
      <span className="cockpit-pillar cockpit-pillar-right hidden xl:block" aria-hidden />

      <aside aria-label="AI 인프라 계기판" className="pointer-events-none fixed inset-0 z-30">
        {/* perspective: 계기판 윗면이 앞으로 눕는 원근을 만든다 */}
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 [perspective:1100px]">
          <div className="drop-shadow-[0_-10px_36px_rgba(34,211,238,0.3)]">
            <details open className="cockpit-dash cockpit-3d group relative overflow-clip">
              <summary className="relative z-10 flex cursor-pointer list-none items-center justify-center gap-4 px-6 py-1 font-mono text-xs uppercase tracking-[0.15em] text-cyan-200/90 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" aria-hidden />
                  AI 인프라 · {formatMonthLabel(yearMonth)}
                </span>
                {overall && overallStyle && (
                  <span className={`flex items-center gap-1.5 font-bold ${overallStyle.text} ${overall === "ok" ? "" : "animate-pulse"}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: overallStyle.color, boxShadow: `0 0 8px ${overallStyle.color}` }} aria-hidden />
                    {OVERALL_TEXT[overall]}
                  </span>
                )}
                {isAdmin && (
                  <Link href={`/infra?month=${yearMonth}`} className="normal-case tracking-normal text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
                    값 입력하기 →
                  </Link>
                )}
                <span className="text-zinc-300 group-open:hidden">▲ 열기</span>
                <span className="hidden text-zinc-300 group-open:inline">▼ 접기</span>
              </summary>

              {/* 위쪽 테두리를 훑는 빛 + 화면 주사선 + 유리 반사 */}
              <span className="cockpit-sweep pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
              <span className="cockpit-scan pointer-events-none absolute inset-0 opacity-30" aria-hidden />
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent" aria-hidden />

              <div className="relative px-3 pb-4 pt-0.5 sm:px-6 lg:px-[5vw]">
                {/* 계기들 뒤로 지나가는 둥근 레일: 판이 사람을 감싸는 곡면처럼 보이게 한다 */}
                <span className="pointer-events-none absolute inset-x-[2%] -top-10 hidden h-32 rounded-[50%] border border-cyan-300/25 lg:block" aria-hidden />
                <span className="pointer-events-none absolute inset-x-[8%] -top-6 hidden h-28 rounded-[50%] border border-fuchsia-300/15 lg:block" aria-hidden />
                <ul className="cockpit-3d-row grid grid-cols-2 items-stretch gap-2 lg:grid-cols-[1fr_1fr_minmax(250px,1.5fr)_1fr_1fr] lg:gap-3">
                  {/* 1. GPU 도입비용: 도입비 합계에서 차지하는 비중을 막대로 */}
                  <Gauge
                    label="GPU 도입비용"
                    value={costs ? formatWon(costs.gpuCapex) : NO_DATA}
                    sub={costs && gpuShare !== null ? `도입비 합계의 ${gpuShare}%` : undefined}
                    tilt="outer-left"
                    color="#22d3ee"
                  >
                    {gpuShare !== null && (
                      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <span className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-300" style={{ width: `${gpuShare}%` }} />
                      </span>
                    )}
                  </Gauge>

                  {/* 2. GPU 갯수: 칩 모양 칸으로 */}
                  <Gauge
                    label="GPU 갯수"
                    value={gpuCount ? `${gpuCount.toLocaleString("ko-KR")}대` : NO_DATA}
                    sub={costs && gpuCount ? `대당 ${formatWon(costs.gpuCapex / gpuCount)}` : undefined}
                    tilt="inner-left"
                    color="#a78bfa"
                  >
                    {gpuCount ? (
                      <span className="flex flex-wrap items-end justify-center gap-0.5" aria-hidden>
                        {Array.from({ length: Math.min(gpuCount, 24) }, (_, i) => (
                          <span key={i} className="h-2 w-2 rounded-[2px] bg-violet-300/80 shadow-[0_0_5px_#a78bfa]" />
                        ))}
                      </span>
                    ) : null}
                  </Gauge>

                  <RoiPanel roi={roi} />

                  {/* 4. 토큰 사용료: 이번 달 금액, 전월 대비, 월별 막대 */}
                  <Gauge
                    label="토큰 사용료 (이번 달)"
                    value={token !== null ? formatWon(token) : NO_DATA}
                    sub={
                      tokenChange === null ? undefined : (
                        <span className={tokenChange >= 0 ? "text-pink-300" : "text-cyan-300"}>
                          전월 대비 {tokenChange >= 0 ? "▲" : "▼"} {Math.abs(tokenChange).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%
                        </span>
                      )
                    }
                    tilt="inner-right"
                    color="#f472b6"
                  >
                    {tokenSeries.length > 0 && (
                      <span className="flex h-5 items-end gap-0.5" aria-hidden>
                        {tokenSeries.map((amount, i) => (
                          <span
                            key={i}
                            className={`w-1.5 rounded-[1px] ${i === tokenSeries.length - 1 ? "bg-pink-300 shadow-[0_0_6px_#f472b6]" : "bg-pink-400/40"}`}
                            style={{ height: `${Math.max(12, (amount / tokenMax) * 100)}%` }}
                          />
                        ))}
                      </span>
                    )}
                  </Gauge>

                  {/* 5. 월 총비용: 상각 + 운영 + 토큰 */}
                  <Gauge
                    label="월 총비용 (이번 달)"
                    value={monthlyTotal !== null ? formatWon(monthlyTotal) : NO_DATA}
                    sub={costs && token !== null ? `상각 ${man(costs.amortMonthly)} · 운영 ${man(costs.opexMonthly)} · 토큰 ${man(token)} (만원)` : undefined}
                    tilt="outer-right"
                    color="#fbbf24"
                  >
                    {costs && token !== null && monthlyTotal ? (
                      <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <span className="block h-full bg-cyan-300" style={{ width: `${(costs.amortMonthly / monthlyTotal) * 100}%` }} />
                        <span className="block h-full bg-violet-400" style={{ width: `${(costs.opexMonthly / monthlyTotal) * 100}%` }} />
                        <span className="block h-full bg-pink-400" style={{ width: `${(token / monthlyTotal) * 100}%` }} />
                      </span>
                    ) : null}
                  </Gauge>
                </ul>
              </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
