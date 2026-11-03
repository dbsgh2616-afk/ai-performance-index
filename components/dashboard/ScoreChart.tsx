// Design Ref: §4.4 월별 AI 지수 — 달마다 합계를 둥근 궤도 게이지로 보여준다. 게이지 끝에 위성이 붙어 있다.
// 입력이 없거나 6개가 다 계산되지 않은 달은 빈 궤도로 둔다.
import { formatScore } from "@/lib/format";

export type GaugeMonth = {
  label: string; // "1월"
  total: number | null; // 보안사고 감점이 반영된 합계. 계산할 수 없는 달은 null
  penalty: boolean; // 보안사고 감점이 적용된 달
  isFocus: boolean; // 요약 카드에 보이는 달
};

const SIZE = 100;
const CENTER = SIZE / 2;
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// 가득 찬 게이지가 시작점과 겹쳐 보이지 않게 끝을 조금 남긴다.
const MAX_SWEEP = 0.94;

function RingGauge({ month, index, max }: { month: GaugeMonth; index: number; max: number }) {
  const ratio = month.total === null ? 0 : Math.max(0.04, (month.total / max) * MAX_SWEEP);
  const gradientId = `ring-gradient-${index}`;
  // 위성 위치: 12시 방향에서 시계 방향으로 ratio만큼 간 곳
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  const satelliteX = CENTER + RADIUS * Math.cos(angle);
  const satelliteY = CENTER + RADIUS * Math.sin(angle);
  const [from, to] = month.penalty ? ["#fb7185", "#fdba74"] : ["#8b5cf6", "#22d3ee"];

  return (
    <li className="flex min-w-0 flex-col items-center gap-1">
      <div
        className={`relative aspect-square w-full max-w-[96px] rounded-full ${
          month.isFocus ? "shadow-[0_0_28px_rgba(103,232,249,0.35)]" : ""
        }`}
        title={month.total === null ? `${month.label}: 데이터 없음` : `${month.label}: ${formatScore(month.total)}${month.penalty ? " (보안사고 -50%)" : ""}`}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          {/* 궤도(바탕 고리) */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle cx={CENTER} cy={CENTER} r={RADIUS - 11} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4" />
          {month.total !== null && (
            <>
              {/* 채워진 궤도 */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE * ratio} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                style={{ filter: `drop-shadow(0 0 4px ${to})` }}
              />
              {/* 게이지 끝의 위성 */}
              <circle cx={satelliteX} cy={satelliteY} r="5.5" fill="#fff" style={{ filter: `drop-shadow(0 0 5px ${to})` }} />
              <circle cx={satelliteX} cy={satelliteY} r="2.2" fill={to} />
            </>
          )}
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold tabular-nums sm:text-xs ${
            month.isFocus ? "text-white" : "text-zinc-300"
          }`}
        >
          {month.total === null ? "-" : Math.round(month.total).toLocaleString("ko-KR")}
        </span>
      </div>
      <span className={`text-[11px] ${month.isFocus ? "font-bold text-cyan-300" : "text-zinc-500"}`}>{month.label}</span>
    </li>
  );
}

export function ScoreChart({ months }: { months: GaugeMonth[] }) {
  const max = Math.max(1, ...months.map((month) => month.total ?? 0));

  return (
    <figure className="flex h-full flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">02 / Orbit gauge</p>
        <figcaption className="mt-1 text-lg font-bold">월별 AI 지수</figcaption>
        <p className="text-xs text-zinc-500">달마다 서비스 6개의 합계입니다. 위성이 멀리 갈수록 지수가 높습니다.</p>
      </div>

      <ol className="grid flex-1 grid-cols-3 content-center gap-x-3 gap-y-4 sm:grid-cols-4 xl:grid-cols-6" aria-label="월별 AI 지수 게이지">
        {months.map((month, index) => (
          <RingGauge key={month.label} month={month} index={index} max={max} />
        ))}
      </ol>

      <p className="text-xs text-zinc-500">
        서비스 6개가 모두 계산된 달만 채워집니다. <span className="text-rose-300">붉은 궤도</span>는 보안사고 감점(-50%)이 반영된 달입니다.
      </p>
    </figure>
  );
}
