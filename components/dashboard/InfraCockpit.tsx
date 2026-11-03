// AI 인프라 계기판 — 화면 하단에 붙어서 스크롤을 따라다니는 우주선 조종석.
// 반원 다이얼 4개(GPU·메모리·스토리지 사용률, 가동률)의 바늘이 처음에 한 번 훑고 값을 가리킨다.
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

function Dial({ kind, label, value }: { kind: "usage" | "uptime"; label: string; value: number }) {
  const level = dialLevel(kind, value);
  const style = LEVEL_STYLE[level];
  const dialValue = toDial(kind, value);
  // 바늘은 위(0°)를 향하게 그려 두고 -90°(왼쪽 끝) ~ +90°(오른쪽 끝)로 돌린다.
  const needleDeg = (dialValue / 100) * 180 - 90;

  return (
    <li className="flex min-w-0 flex-col items-center rounded-xl border border-cyan-300/15 bg-black/40 px-2 pb-2 pt-1 shadow-[inset_0_0_18px_rgba(34,211,238,0.08)]">
      <svg viewBox="0 0 200 122" className="w-full max-w-[150px]" role="img" aria-label={`${label} ${value}%`}>
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
      <p className="-mt-0.5 truncate text-[11px] font-medium text-zinc-200">{label}</p>
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

export function InfraCockpit({ snapshot, yearMonth, isAdmin }: { snapshot: InfraSnapshot | null; yearMonth: string; isAdmin: boolean }) {
  const overall = snapshot ? overallLevel(snapshot) : null;
  const overallStyle = overall ? LEVEL_STYLE[overall] : null;

  return (
    <aside aria-label="AI 인프라 계기판" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 sm:px-4">
      {/* 조종석 모양: 아래가 넓은 사다리꼴(cockpit-shape) + 그라데이션 테두리(cockpit-body). summary는 details의 바로 아래 자식이어야 한다. */}
      <div className="pointer-events-auto w-full max-w-5xl drop-shadow-[0_-8px_30px_rgba(34,211,238,0.28)]">
        <details open className="cockpit-shape cockpit-body group relative overflow-hidden">
            <summary className="relative z-10 flex cursor-pointer list-none items-center justify-between gap-3 px-12 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/80 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9] animate-pulse" aria-hidden />
                Cockpit · AI 인프라 · {formatMonthLabel(yearMonth)}
              </span>
              <span className="flex items-center gap-3">
                {overall && overallStyle && (
                  <span className={`flex items-center gap-1.5 font-bold ${overallStyle.text} ${overall === "ok" ? "" : "animate-pulse"}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: overallStyle.color, boxShadow: `0 0 8px ${overallStyle.color}` }} aria-hidden />
                    {OVERALL_TEXT[overall]}
                  </span>
                )}
                <span className="text-zinc-400 group-open:hidden">▲ 열기</span>
                <span className="hidden text-zinc-400 group-open:inline">▼ 접기</span>
              </span>
            </summary>

            {/* 위쪽 테두리를 훑는 빛 + 화면 주사선 */}
            <span className="cockpit-sweep pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
            <span className="cockpit-scan pointer-events-none absolute inset-0 opacity-30" aria-hidden />

            <div className="relative px-6 pb-3 pt-1 sm:px-10">
              {snapshot === null ? (
                <p className="py-4 text-center text-sm text-zinc-400">
                  데이터 없음 — 이 달의 인프라 지표가 아직 입력되지 않았습니다.
                  {isAdmin && (
                    <Link href={`/infra?month=${yearMonth}`} className="ml-2 font-medium text-fuchsia-400 underline underline-offset-4 hover:text-fuchsia-300">
                      값 입력하기 →
                    </Link>
                  )}
                </p>
              ) : (
                <>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {INFRA_GAUGES.map((gauge) => (
                      <Dial key={gauge.key} kind={gauge.kind} label={gauge.label} value={snapshot.values[gauge.key]} />
                    ))}
                  </ul>
                  <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
                    <span>월 대표값 · 지수 계산에는 쓰이지 않습니다.</span>
                    {isAdmin && (
                      <Link href={`/infra?month=${yearMonth}`} className="font-medium text-fuchsia-400 underline underline-offset-4 hover:text-fuchsia-300">
                        값 입력하기 →
                      </Link>
                    )}
                  </p>
                </>
              )}
            </div>
        </details>
      </div>
    </aside>
  );
}
