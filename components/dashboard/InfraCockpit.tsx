// AI 인프라 계기판 — 화면 하단에 붙어 스크롤을 따라다니는 1인칭 우주선 조종석.
// 높이를 낮추고 3D로 기울였다: 계기판 윗면이 앞으로 눕고(원근), 다이얼과 가운데 ROI 패널이 판 위로 떠 있다(깊이).
// 가운데는 추정 ROI, 양옆 날개에 다이얼 2개씩(GPU·메모리 / 스토리지·가동률). 바깥 다이얼은 안쪽으로 꺾여 있다.
// 값은 관리자가 월 1회 직접 입력한 것이며 지수 계산에는 쓰이지 않는다. 접기/펴기는 <details>라서 자바스크립트가 필요 없다.
import Link from "next/link";

import { formatMonthLabel } from "@/lib/format";
import { dialLevel, INFRA_GAUGES, type DialLevel, type InfraSnapshot } from "@/lib/infra";
import { formatWon, type RoiResult } from "@/lib/roi";

const LEVEL_STYLE: Record<DialLevel, { label: string; text: string; color: string }> = {
  ok: { label: "정상", text: "text-cyan-300", color: "#22d3ee" },
  warn: { label: "주의", text: "text-amber-300", color: "#fbbf24" },
  danger: { label: "위험", text: "text-rose-300", color: "#fb7185" },
};

const CX = 100;
const CY = 100;
const R = 78;

// 0~100% 값을 반원(왼쪽 180° → 오른쪽 0°) 위의 각도(라디안)로 바꾼다.
const angleOf = (percent: number) => Math.PI * (1 - Math.min(100, Math.max(0, percent)) / 100);
const pointOn = (percent: number, radius: number) => ({
  x: CX + radius * Math.cos(angleOf(percent)),
  y: CY - radius * Math.sin(angleOf(percent)),
});
// from~to(%) 구간을 반원 호로 그린다.
function arc(from: number, to: number, radius = R) {
  const start = pointOn(from, radius);
  const end = pointOn(to, radius);
  return `M${start.x.toFixed(2)},${start.y.toFixed(2)} A${radius},${radius} 0 0 1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
}

// 구간 색: 사용률은 낮을수록 좋고, 가동률은 높을수록 좋다. (dialLevel과 같은 기준선)
const ZONES: Record<"usage" | "uptime", { from: number; to: number; level: DialLevel }[]> = {
  usage: [
    { from: 0, to: 70, level: "ok" },
    { from: 70, to: 85, level: "warn" },
    { from: 85, to: 100, level: "danger" },
  ],
  uptime: [
    { from: 0, to: 99, level: "danger" },
    { from: 99, to: 99.5, level: "warn" },
    { from: 99.5, to: 100, level: "ok" },
  ],
};

// 가동률은 98~100% 구간이 중요하므로 다이얼 눈금을 그 범위로 넓혀 보여준다.
const UPTIME_MIN = 98;
const toDial = (kind: "usage" | "uptime", value: number) =>
  kind === "uptime" ? ((Math.max(UPTIME_MIN, value) - UPTIME_MIN) / (100 - UPTIME_MIN)) * 100 : value;

// 다이얼은 판 위로 살짝 떠 있고(translateZ), 바깥쪽일수록 가운데를 향해 더 꺾인다. 곡선 계기판을 따라 바깥은 조금 아래에 놓인다.
const TILT_CLASS = {
  "outer-left": "lg:translate-y-2 lg:[transform:perspective(600px)_translateZ(14px)_rotateY(20deg)]",
  "inner-left": "lg:[transform:perspective(600px)_translateZ(18px)_rotateY(9deg)]",
  "inner-right": "lg:[transform:perspective(600px)_translateZ(18px)_rotateY(-9deg)]",
  "outer-right": "lg:translate-y-2 lg:[transform:perspective(600px)_translateZ(14px)_rotateY(-20deg)]",
} as const;

type Tilt = keyof typeof TILT_CLASS;

function Dial({ kind, label, value, tilt }: { kind: "usage" | "uptime"; label: string; value: number; tilt: Tilt }) {
  const level = dialLevel(kind, value);
  const style = LEVEL_STYLE[level];
  const dialValue = toDial(kind, value);
  // 바늘은 위(0°)를 향하게 그려 두고 -90°(왼쪽 끝) ~ +90°(오른쪽 끝)로 돌린다.
  const needleDeg = (dialValue / 100) * 180 - 90;

  return (
    <li
      className={`flex min-w-0 flex-col items-center rounded-xl border border-cyan-200/25 border-b-black/60 bg-gradient-to-b from-[#161c3d] to-[#070914] px-1.5 pb-1.5 pt-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_0_16px_rgba(34,211,238,0.1),0_14px_16px_-6px_rgba(0,0,0,0.85)] ${TILT_CLASS[tilt]}`}
    >
      <svg viewBox="0 0 200 122" className="w-full max-w-[120px]" role="img" aria-label={`${label} ${value}%`}>
        {/* 바탕 호 + 구간 색 호(현재 구간만 밝게) */}
        <path d={arc(0, 100)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" strokeLinecap="round" />
        {ZONES[kind].map((zone) => {
          const from = kind === "uptime" ? toDial(kind, Math.max(zone.from, UPTIME_MIN)) : zone.from;
          const to = kind === "uptime" ? toDial(kind, Math.max(zone.to, UPTIME_MIN)) : zone.to;
          if (to <= from) return null;
          return (
            <path
              key={zone.level}
              d={arc(from, to)}
              fill="none"
              stroke={LEVEL_STYLE[zone.level].color}
              strokeWidth="10"
              opacity={zone.level === level ? 1 : 0.28}
              style={zone.level === level ? { filter: `drop-shadow(0 0 5px ${LEVEL_STYLE[zone.level].color})` } : undefined}
            />
          );
        })}
        {/* 눈금: 큰 눈금 5개 + 작은 눈금 */}
        {Array.from({ length: 21 }, (_, i) => i * 5).map((tick) => {
          const big = tick % 25 === 0;
          const a = pointOn(tick, R + (big ? 15 : 12));
          const b = pointOn(tick, R + 7);
          return <line key={tick} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={big ? "rgba(207,250,254,0.85)" : "rgba(255,255,255,0.3)"} strokeWidth={big ? 2 : 1} />;
        })}
        {/* 바늘: 처음에 왼쪽 끝에서 값까지 한 번 훑는다 */}
        <g className="infra-needle" style={{ ["--needle" as string]: `${needleDeg}deg`, transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M${CX - 4},${CY} L${CX},${CY - (R - 8)} L${CX + 4},${CY} Z`} fill="#fff" style={{ filter: `drop-shadow(0 0 5px ${style.color})` }} />
        </g>
        <circle cx={CX} cy={CY} r="10" fill="#0b1026" stroke={style.color} strokeWidth="3.5" className={level === "danger" ? "animate-pulse" : undefined} />
        <circle cx={CX} cy={CY} r="3.5" fill={style.color} />
        <text x={CX} y={CY - 30} textAnchor="middle" className="fill-white font-mono text-[28px] font-bold">
          {value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
          <tspan className="fill-zinc-400 text-[14px]">%</tspan>
        </text>
      </svg>
      <p className="-mt-1 max-w-full truncate text-xs font-medium text-zinc-100">{label}</p>
      <p className={`flex items-center gap-1 font-mono text-xs font-bold ${style.text}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color, boxShadow: `0 0 6px ${style.color}` }} />
        {style.label}
      </p>
    </li>
  );
}

// 계기판 전체 상태: 하나라도 위험이면 위험, 주의가 있으면 주의, 아니면 정상
function overallLevel(snapshot: InfraSnapshot): DialLevel {
  const levels = INFRA_GAUGES.map((gauge) => dialLevel(gauge.kind, snapshot.values[gauge.key]));
  return levels.includes("danger") ? "danger" : levels.includes("warn") ? "warn" : "ok";
}

const OVERALL_TEXT: Record<DialLevel, string> = {
  ok: "ALL SYSTEMS NOMINAL",
  warn: "MASTER CAUTION",
  danger: "MASTER WARNING",
};

// 가운데 ROI 패널: 이 계기판의 주인공이라 가장 크고 밝게 보여 준다.
function RoiPanel({ roi }: { roi: RoiResult | null }) {
  const positive = roi !== null && roi.roiPct >= 0;
  const color = roi === null ? "#a1a1aa" : positive ? "#34f5d0" : "#fb7185";

  return (
    <li
      className="order-first col-span-2 flex min-w-0 flex-col items-center justify-center rounded-2xl border px-4 py-2 lg:order-none lg:col-span-1 lg:[transform:perspective(600px)_translateZ(30px)]"
      style={{
        borderColor: `${color}99`,
        background: `radial-gradient(120% 140% at 50% 0%, ${color}33, #070914 70%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 34px ${color}55, 0 16px 20px -6px rgba(0,0,0,0.9)`,
      }}
    >
      <p className="text-sm font-bold tracking-wide text-zinc-100">추정 ROI</p>
      {roi === null ? (
        <p className="font-mono text-3xl font-extrabold text-zinc-300">데이터 없음</p>
      ) : (
        <>
          <p
            className="font-mono text-5xl font-extrabold tabular-nums leading-none"
            style={{ color, textShadow: `0 0 12px ${color}, 0 0 34px ${color}aa` }}
          >
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
  gpuCount,
}: {
  snapshot: InfraSnapshot | null;
  yearMonth: string;
  isAdmin: boolean;
  roi: RoiResult | null;
  gpuCount?: number;
}) {
  const gauge = (key: (typeof INFRA_GAUGES)[number]["key"], tilt: Tilt) => {
    const item = INFRA_GAUGES.find((entry) => entry.key === key)!;
    const label = key === "gpu" && gpuCount ? `${item.label} · ${gpuCount.toLocaleString("ko-KR")}대` : item.label;
    return <Dial key={key} kind={item.kind} label={label} value={snapshot!.values[key]} tilt={tilt} />;
  };
  const overall = snapshot ? overallLevel(snapshot) : null;
  const overallStyle = overall ? LEVEL_STYLE[overall] : null;

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

              <div className="relative px-3 pb-2.5 pt-0.5 sm:px-6 lg:px-[3vw]">
                {snapshot === null ? (
                  <p className="py-3 text-center text-sm text-zinc-300">데이터 없음</p>
                ) : (
                  <ul className="cockpit-3d-row grid grid-cols-2 items-end gap-2 lg:grid-cols-[1fr_1fr_minmax(250px,1.5fr)_1fr_1fr] lg:gap-3">
                    {gauge("gpu", "outer-left")}
                    {gauge("memory", "inner-left")}
                    <RoiPanel roi={roi} />
                    {gauge("storage", "inner-right")}
                    {gauge("uptime", "outer-right")}
                  </ul>
                )}
              </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  );
}
