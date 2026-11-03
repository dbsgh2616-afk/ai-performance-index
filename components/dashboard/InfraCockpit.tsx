// AI 인프라 계기판 — 화면 하단에 붙어 스크롤을 따라다니는 1인칭 조종석.
// 구도: 조종석에 앉아 앞창(= 이 페이지)을 보고, 눈앞에 계기판이 있다. 윗면의 눈부심 방지 덮개(글레어 실드),
// 앞유리 양옆 기둥, 베젤이 둘린 유리 화면 5개(양옆 2개씩 + 가운데 ROI), 화면 아래 물리 버튼 줄, 양끝의 회전 손잡이.
// 가운데 화면은 추정 ROI, 나머지는 GPU 도입비용 · GPU 갯수 · 토큰 사용료 · 월 총비용이다.
// 윗줄의 경고등은 그 달 인프라 사용률(GPU·메모리·스토리지)과 가동률로 정한다. 값은 모두 관리자가 직접 입력한 것이다.
// 모양(질감·반사·그림자)은 app/globals.css의 cockpit-* 클래스에 있다. 접기/펴기는 <details>라서 자바스크립트가 필요 없다.
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

// 화면들은 사람을 향해 부채꼴로 꺾여 있다. 바깥쪽일수록 더 꺾이고 조금 앞으로 나와 있다. (넓은 화면에서만)
const TILT_CLASS = {
  "outer-left": "lg:translate-y-2 lg:[transform:perspective(900px)_translateZ(14px)_rotateY(22deg)]",
  "inner-left": "lg:[transform:perspective(900px)_translateZ(8px)_rotateY(10deg)]",
  "inner-right": "lg:[transform:perspective(900px)_translateZ(8px)_rotateY(-10deg)]",
  "outer-right": "lg:translate-y-2 lg:[transform:perspective(900px)_translateZ(14px)_rotateY(-22deg)]",
} as const;

type Tilt = keyof typeof TILT_CLASS;

const NO_DATA = "데이터 없음";
// 작은 글자 칸에는 만원 단위 숫자만 쓴다. 예: 400 (= 400만원)
const man = (value: number) => Math.round(value / 10_000).toLocaleString("ko-KR");

// 화면 아래의 작은 물리 버튼 줄 (장식)
function BezelButtons() {
  return (
    <span className="mt-1 flex justify-center gap-1.5" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="cockpit-key" />
      ))}
    </span>
  );
}

// 베젤이 둘린 유리 화면 하나. 위 줄은 화면 이름, 가운데는 큰 값, 아래는 보조 표시.
function Mfd({ label, value, sub, tilt, color, children }: { label: string; value: string; sub?: ReactNode; tilt: Tilt; color: string; children?: ReactNode }) {
  return (
    <li className={`cockpit-bezel flex min-w-0 flex-col ${TILT_CLASS[tilt]}`}>
      <div className="cockpit-screen flex flex-1 flex-col items-center justify-between gap-0.5 px-2 pb-1.5 pt-1">
        <p className="max-w-full truncate text-xs font-medium text-cyan-100/80">{label}</p>
        <p className="max-w-full truncate font-mono text-2xl font-extrabold leading-tight tabular-nums" style={{ color, textShadow: `0 0 10px ${color}99` }}>
          {value}
        </p>
        <div className="flex h-4 w-full items-end justify-center">{children}</div>
        <p className="max-w-full break-keep text-center text-xs leading-tight text-zinc-300">{sub}</p>
      </div>
      <BezelButtons />
    </li>
  );
}

// 가운데 화면: 이 계기판의 주인공이라 가장 크고 밝게 보여 준다.
function RoiScreen({ roi }: { roi: RoiResult | null }) {
  const positive = roi !== null && roi.roiPct >= 0;
  const color = roi === null ? "#a1a1aa" : positive ? "#34f5d0" : "#fb7185";

  return (
    <li className="cockpit-bezel order-first col-span-2 flex min-w-0 flex-col lg:order-none lg:col-span-1 lg:[transform:perspective(900px)_translateZ(18px)]">
      <div className="cockpit-screen flex flex-1 flex-col items-center justify-center px-4 py-2" style={{ boxShadow: `inset 0 0 22px rgba(0,0,0,.9), inset 0 0 0 1px ${color}55, 0 0 30px ${color}40` }}>
        <p className="text-sm font-bold tracking-wide text-cyan-100">추정 ROI</p>
        {roi === null ? (
          <p className="font-mono text-3xl font-extrabold text-zinc-300">{NO_DATA}</p>
        ) : (
          <>
            <p className="font-mono text-5xl font-extrabold tabular-nums leading-none" style={{ color, textShadow: `0 0 12px ${color}, 0 0 30px ${color}99` }}>
              {positive ? "+" : ""}
              {roi.roiPct.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%
            </p>
            <p className="mt-1 text-xs text-zinc-200">
              효과 {formatWon(roi.benefit)} · 비용 {formatWon(roi.cost)}
            </p>
          </>
        )}
      </div>
      <BezelButtons />
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
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 [perspective:1200px]">
          <details open className="cockpit-dash cockpit-3d group relative overflow-clip">
            {/* 눈부심 방지 덮개: 위쪽 띠. 경고등, 제목, 스위치가 달려 있다. */}
            <summary className="cockpit-glare relative z-10 flex cursor-pointer list-none items-center justify-center gap-5 px-[8vw] py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-cyan-100/90 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-3">
                {overall && overallStyle ? (
                  <span
                    className={`cockpit-annunciator font-bold ${overall === "ok" ? "" : "animate-pulse"}`}
                    style={{ color: overallStyle.color, borderColor: `${overallStyle.color}88`, background: `${overallStyle.color}1f`, boxShadow: `0 0 12px ${overallStyle.color}55` }}
                  >
                    {OVERALL_TEXT[overall]}
                  </span>
                ) : null}
                <span className="hidden items-center gap-1.5 sm:flex" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="cockpit-toggle" />
                  ))}
                </span>
              </span>
              <span className="text-zinc-200">AI 인프라 · {formatMonthLabel(yearMonth)}</span>
              <span className="flex items-center gap-3">
                {isAdmin && (
                  <Link href={`/infra?month=${yearMonth}`} className="normal-case tracking-normal text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
                    값 입력하기 →
                  </Link>
                )}
                <span className="text-zinc-300 group-open:hidden">▲ 열기</span>
                <span className="hidden text-zinc-300 group-open:inline">▼ 접기</span>
              </span>
            </summary>

            {/* 양끝 회전 손잡이 (장식) */}
            <span className="cockpit-knob absolute bottom-4 left-[1.6vw] hidden lg:block" aria-hidden />
            <span className="cockpit-knob absolute bottom-4 right-[1.6vw] hidden lg:block" aria-hidden />

            <div className="relative px-3 pb-3 pt-2 sm:px-6 lg:px-[5vw]">
              <ul className="cockpit-3d-row grid grid-cols-2 items-stretch gap-2 lg:grid-cols-[1fr_1fr_minmax(250px,1.5fr)_1fr_1fr] lg:gap-3">
                {/* 1. GPU 도입비용: 도입비 합계에서 차지하는 비중을 막대로 */}
                <Mfd
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
                </Mfd>

                {/* 2. GPU 갯수: 칩 모양 칸으로 */}
                <Mfd
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
                </Mfd>

                <RoiScreen roi={roi} />

                {/* 4. 토큰 사용료: 이번 달 금액, 전월 대비, 월별 막대 */}
                <Mfd
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
                    <span className="flex h-4 items-end gap-0.5" aria-hidden>
                      {tokenSeries.map((amount, i) => (
                        <span
                          key={i}
                          className={`w-1.5 rounded-[1px] ${i === tokenSeries.length - 1 ? "bg-pink-300 shadow-[0_0_6px_#f472b6]" : "bg-pink-400/40"}`}
                          style={{ height: `${Math.max(12, (amount / tokenMax) * 100)}%` }}
                        />
                      ))}
                    </span>
                  )}
                </Mfd>

                {/* 5. 월 총비용: 상각 + 운영 + 토큰 */}
                <Mfd
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
                </Mfd>
              </ul>
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
