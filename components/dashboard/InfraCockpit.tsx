// AI 인프라 계기판 — 우주선 조종석처럼 반원 다이얼 4개(GPU·메모리·스토리지 사용률, 가동률)를 보여준다.
// 바늘이 값을 가리키고, 호가 초록·주황·빨강 구간으로 나뉜다. 값은 관리자가 월 1회 직접 입력한 것이다.
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
const R = 80;

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
const toDial = (kind: "usage" | "uptime", value: number) => (kind === "uptime" ? ((Math.max(UPTIME_MIN, value) - UPTIME_MIN) / (100 - UPTIME_MIN)) * 100 : value);

function Dial({ kind, label, value }: { kind: "usage" | "uptime"; label: string; value: number }) {
  const level = dialLevel(kind, value);
  const style = LEVEL_STYLE[level];
  const dialValue = toDial(kind, value);
  const needleTip = pointOn(dialValue, R - 10);

  return (
    <li className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 pb-4 pt-3">
      <svg viewBox="0 0 200 120" className="w-full max-w-[220px]" role="img" aria-label={`${label} ${value}%`}>
        {/* 바탕 호 + 구간 색 호 */}
        <path d={arc(0, 100)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
        {ZONES[kind].map((zone) => {
          const from = kind === "uptime" ? toDial(kind, Math.max(zone.from, UPTIME_MIN)) : zone.from;
          const to = kind === "uptime" ? toDial(kind, Math.max(zone.to, UPTIME_MIN)) : zone.to;
          if (to <= from) return null;
          return (
            <path key={zone.level} d={arc(from, to)} fill="none" stroke={LEVEL_STYLE[zone.level].color} strokeWidth="8" opacity={zone.level === level ? 0.95 : 0.35} />
          );
        })}
        {/* 눈금 */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const a = pointOn(tick, R + 12);
          const b = pointOn(tick, R + 6);
          return <line key={tick} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />;
        })}
        {/* 바늘 */}
        <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${style.color})` }} />
        <circle cx={CX} cy={CY} r="7" fill="#1e1b4b" stroke={style.color} strokeWidth="2.5" />
        <text x={CX} y={CY - 26} textAnchor="middle" className="fill-white font-mono text-[22px] font-bold">
          {value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%
        </text>
      </svg>
      <p className="text-sm font-medium">{label}</p>
      <p className={`text-xs font-bold ${style.text}`}>{style.label}</p>
    </li>
  );
}

export function InfraCockpit({ snapshot, yearMonth, isAdmin }: { snapshot: InfraSnapshot | null; yearMonth: string; isAdmin: boolean }) {
  return (
    <section aria-label="AI 인프라 계기판" className="glass flex flex-col gap-4 rounded-3xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">Cockpit</p>
          <h2 className="mt-1 text-lg font-bold">AI 인프라 계기판</h2>
          <p className="text-xs text-zinc-500">{formatMonthLabel(yearMonth)} 기준 월 대표값입니다. 지수 계산에는 쓰이지 않습니다.</p>
        </div>
        {isAdmin && (
          <Link href={`/infra?month=${yearMonth}`} className="text-sm font-medium text-fuchsia-400 underline underline-offset-4 hover:text-fuchsia-300">
            값 입력하기 →
          </Link>
        )}
      </div>

      {snapshot === null ? (
        <p className="text-sm text-zinc-500">데이터 없음 — 이 달의 인프라 지표가 아직 입력되지 않았습니다.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INFRA_GAUGES.map((gauge) => (
            <Dial key={gauge.key} kind={gauge.kind} label={gauge.label} value={snapshot.values[gauge.key]} />
          ))}
        </ul>
      )}
    </section>
  );
}
