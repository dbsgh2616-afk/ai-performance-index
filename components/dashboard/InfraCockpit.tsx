// AI 인프라 계기판 — 화면 하단에 붙어 스크롤을 따라다니는 1인칭 우주선 조종석.
// 조종석에 앉아 앞(별이 쏟아지는 창밖)을 보는 구도다. 계기판은 화면 왼쪽 끝부터 오른쪽 끝까지 펼쳐지고,
// 양옆 날개에 다이얼 2개씩, 가운데에 종합 콘솔이 있다. 바깥 다이얼은 안쪽으로 살짝 꺾여 있다.
// 값은 관리자가 월 1회 직접 입력한 것이며 지수 계산에는 쓰이지 않는다. 접기/펴기는 <details>라서 자바스크립트가 필요 없다.
import Link from "next/link";

import { formatMonthLabel } from "@/lib/format";
import { dialLevel, INFRA_GAUGES, type DialLevel, type InfraSnapshot } from "@/lib/infra";

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

// 날개의 바깥쪽 다이얼은 안쪽(가운데)을 향해 꺾이고, 곡선 계기판을 따라 조금 아래에 놓인다.
const TILT_CLASS = {
  "outer-left": "lg:translate-y-3 lg:[transform:perspective(700px)_rotateY(16deg)]",
  "inner-left": "lg:[transform:perspective(700px)_rotateY(7deg)]",
  "inner-right": "lg:[transform:perspective(700px)_rotateY(-7deg)]",
  "outer-right": "lg:translate-y-3 lg:[transform:perspective(700px)_rotateY(-16deg)]",
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
      className={`flex min-w-0 flex-col items-center rounded-2xl border border-cyan-300/20 bg-black/55 px-2 pb-2 pt-1 shadow-[inset_0_0_22px_rgba(34,211,238,0.1),0_0_18px_rgba(0,0,0,0.6)] ${TILT_CLASS[tilt]}`}
    >
      <svg viewBox="0 0 200 122" className="w-full max-w-[200px]" role="img" aria-label={`${label} ${value}%`}>
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
              strokeWidth="9"
              opacity={zone.level === level ? 1 : 0.28}
              style={zone.level === level ? { filter: `drop-shadow(0 0 5px ${LEVEL_STYLE[zone.level].color})` } : undefined}
            />
          );
        })}
        {/* 눈금: 큰 눈금 5개 + 작은 눈금 */}
        {Array.from({ length: 21 }, (_, i) => i * 5).map((tick) => {
          const big = tick % 25 === 0;
          const a = pointOn(tick, R + (big ? 14 : 11));
          const b = pointOn(tick, R + 6);
          return <line key={tick} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={big ? "rgba(207,250,254,0.8)" : "rgba(255,255,255,0.28)"} strokeWidth={big ? 1.8 : 1} />;
        })}
        {/* 안쪽 유리 반사 */}
        <path d={arc(8, 60, R - 22)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" strokeLinecap="round" />
        {/* 바늘: 처음에 왼쪽 끝에서 값까지 한 번 훑는다 */}
        <g className="infra-needle" style={{ ["--needle" as string]: `${needleDeg}deg`, transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M${CX - 3},${CY} L${CX},${CY - (R - 8)} L${CX + 3},${CY} Z`} fill="#fff" style={{ filter: `drop-shadow(0 0 5px ${style.color})` }} />
        </g>
        <circle cx={CX} cy={CY} r="9" fill="#0b1026" stroke={style.color} strokeWidth="3" className={level === "danger" ? "animate-pulse" : undefined} />
        <circle cx={CX} cy={CY} r="3" fill={style.color} />
        <text x={CX} y={CY - 30} textAnchor="middle" className="fill-white font-mono text-[25px] font-bold">
          {value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
          <tspan className="fill-zinc-400 text-[13px]">%</tspan>
        </text>
      </svg>
      <p className="-mt-0.5 truncate text-xs font-medium text-zinc-200">{label}</p>
      <p className={`flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
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

// 가운데 종합 콘솔: 경고등, 월, 항목별 표시등, 장식 스위치
function Console({ snapshot, yearMonth, isAdmin }: { snapshot: InfraSnapshot; yearMonth: string; isAdmin: boolean }) {
  const overall = overallLevel(snapshot);
  const style = LEVEL_STYLE[overall];

  return (
    <li className="order-first col-span-2 flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-fuchsia-400/25 bg-black/60 px-4 py-3 shadow-[inset_0_0_26px_rgba(217,70,239,0.12)] lg:order-none lg:col-span-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fuchsia-300/80">AI infra · {formatMonthLabel(yearMonth)}</p>

      {/* 종합 경고등 */}
      <div
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs font-bold tracking-widest ${style.text} ${overall === "ok" ? "" : "animate-pulse"}`}
        style={{ borderColor: `${style.color}66`, background: `${style.color}14`, boxShadow: `0 0 18px ${style.color}33` }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: style.color, boxShadow: `0 0 10px ${style.color}` }} aria-hidden />
        {OVERALL_TEXT[overall]}
      </div>

      {/* 항목별 표시등 */}
      <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1">
        {INFRA_GAUGES.map((gauge) => {
          const level = dialLevel(gauge.kind, snapshot.values[gauge.key]);
          return (
            <li key={gauge.key} className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_STYLE[level].color, boxShadow: `0 0 6px ${LEVEL_STYLE[level].color}` }} aria-hidden />
              {gauge.key}
            </li>
          );
        })}
      </ul>

      {/* 장식: 토글 스위치 줄과 깜빡이는 작은 표시등 */}
      <div className="flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-3.5 w-1.5 rounded-sm bg-zinc-600">
            <span className={`block h-1.5 w-1.5 rounded-sm ${i % 2 === 0 ? "bg-cyan-300" : "mt-2 bg-zinc-400"}`} />
          </span>
        ))}
        {[0, 1, 2].map((i) => (
          <span key={i} className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
      </div>

      {isAdmin && (
        <Link href={`/infra?month=${yearMonth}`} className="text-[11px] font-medium text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200">
          값 입력하기 →
        </Link>
      )}
    </li>
  );
}

export function InfraCockpit({ snapshot, yearMonth, isAdmin }: { snapshot: InfraSnapshot | null; yearMonth: string; isAdmin: boolean }) {
  const gauge = (key: (typeof INFRA_GAUGES)[number]["key"], tilt: Tilt) => {
    const item = INFRA_GAUGES.find((entry) => entry.key === key)!;
    return <Dial key={key} kind={item.kind} label={item.label} value={snapshot!.values[key]} tilt={tilt} />;
  };

  return (
    <aside aria-label="AI 인프라 계기판" className="pointer-events-none fixed inset-0 z-30">
      {/* 앞유리 양옆 기둥: 위는 가늘고 아래는 굵게 계기판과 이어진다. 넓은 화면에서만 보인다. */}
      <span className="cockpit-pillar cockpit-pillar-left hidden xl:block" aria-hidden />
      <span className="cockpit-pillar cockpit-pillar-right hidden xl:block" aria-hidden />

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 drop-shadow-[0_-10px_40px_rgba(34,211,238,0.3)]">
        <details open className="cockpit-dash group relative overflow-hidden">
          <summary className="relative z-10 flex cursor-pointer list-none items-center justify-center gap-3 px-6 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" aria-hidden />
            AI 인프라
            <span className="text-zinc-400 group-open:hidden">▲ 열기</span>
            <span className="hidden text-zinc-400 group-open:inline">▼ 접기</span>
          </summary>

          {/* 위쪽 테두리를 훑는 빛 + 화면 주사선 + 유리 반사 */}
          <span className="cockpit-sweep pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
          <span className="cockpit-scan pointer-events-none absolute inset-0 opacity-30" aria-hidden />
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent" aria-hidden />

          <div className="relative px-3 pb-4 pt-1 sm:px-6 lg:px-[4vw]">
            {snapshot === null ? (
              <p className="py-6 text-center text-sm text-zinc-400">
                데이터 없음
                {isAdmin && (
                  <Link href={`/infra?month=${yearMonth}`} className="ml-2 font-medium text-fuchsia-400 underline underline-offset-4 hover:text-fuchsia-300">
                    값 입력하기 →
                  </Link>
                )}
              </p>
            ) : (
              <ul className="grid grid-cols-2 items-end gap-2 lg:grid-cols-[1fr_1fr_minmax(230px,1.15fr)_1fr_1fr] lg:gap-3">
                {gauge("gpu", "outer-left")}
                {gauge("memory", "inner-left")}
                <Console snapshot={snapshot} yearMonth={yearMonth} isAdmin={isAdmin} />
                {gauge("storage", "inner-right")}
                {gauge("uptime", "outer-right")}
              </ul>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
