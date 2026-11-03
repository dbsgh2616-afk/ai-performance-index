// Design Ref: §4.4 월별 AI 지수 — 주식 차트처럼 달별 합계를 이은 선그래프. 우주선이 이번 달 위치를 날아가고 있다.
// 입력이 없거나 6개가 다 계산되지 않은 달(total이 null)에서는 선이 끊긴다.
import { formatScore } from "@/lib/format";
import { niceScale, runsOf, smoothPath, type Point } from "@/lib/line-chart";

export type GaugeMonth = {
  label: string; // "1월"
  total: number | null; // 보안사고 감점이 반영된 합계. 계산할 수 없는 달은 null
  penalty: boolean; // 보안사고 감점이 적용된 달
  isFocus: boolean; // 요약 카드에 보이는 달
};

const WIDTH = 640;
const HEIGHT = 300;
const PAD = { left: 56, right: 28, top: 36, bottom: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const compact = (value: number) => (value >= 10000 ? `${Math.round(value / 1000).toLocaleString("ko-KR")}k` : value.toLocaleString("ko-KR"));

export function ScoreChart({ months }: { months: GaugeMonth[] }) {
  const { top, ticks } = niceScale(Math.max(1, ...months.map((month) => month.total ?? 0)));
  const x = (index: number) => PAD.left + (months.length === 1 ? PLOT_W / 2 : (PLOT_W * index) / (months.length - 1));
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;

  const runs = runsOf(months.map((month) => month.total));
  const pointOf = (index: number): Point => ({ x: x(index), y: y(months[index].total ?? 0) });

  // 우주선: 이번 달(focus) 점 위에서 선의 기울기 방향을 향한다.
  const focusIndex = months.findIndex((month) => month.isFocus && month.total !== null);
  let shipAngle = -12;
  if (focusIndex > 0 && months[focusIndex - 1].total !== null) {
    const from = pointOf(focusIndex - 1);
    const to = pointOf(focusIndex);
    shipAngle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  }
  const ship = focusIndex >= 0 ? pointOf(focusIndex) : null;

  return (
    <figure className="flex h-full flex-col gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">02 / Flight path</p>
        <figcaption className="mt-1 text-lg font-bold">월별 AI 지수</figcaption>
        <p className="text-xs text-zinc-500">달마다 서비스 6개의 합계를 이은 항로입니다. 우주선이 이번 달 위치입니다.</p>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="월별 AI 지수 선그래프">
        <defs>
          <linearGradient id="flight-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="flight-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c026d3" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4c1d95" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 가로 눈금선과 세로축 숫자 */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,0.07)" strokeDasharray={tick === 0 ? undefined : "3 5"} />
            <text x={PAD.left - 10} y={y(tick) + 3.5} textAnchor="end" className="fill-zinc-500 font-mono text-[10px]">
              {compact(Math.round(tick))}
            </text>
          </g>
        ))}

        {/* 달 이름 */}
        {months.map((month, index) => (
          <text
            key={month.label}
            x={x(index)}
            y={HEIGHT - 14}
            textAnchor="middle"
            className={`font-mono text-[10px] ${month.isFocus ? "fill-cyan-300 font-bold" : "fill-zinc-500"}`}
          >
            {month.label}
          </text>
        ))}

        {/* 이번 달 세로 안내선 */}
        {ship && <line x1={ship.x} x2={ship.x} y1={PAD.top - 8} y2={PAD.top + PLOT_H} stroke="rgba(103,232,249,0.35)" strokeDasharray="2 4" />}

        {/* 면과 선: 값이 이어진 구간마다 그린다 */}
        {runs.map((run) => {
          const points = run.map(pointOf);
          const line = smoothPath(points);
          if (!line) return null;
          const baseline = PAD.top + PLOT_H;
          return (
            <g key={run[0]}>
              <path d={`${line} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`} fill="url(#flight-area)" />
              <path d={line} fill="none" stroke="url(#flight-line)" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(232,121,249,0.8))" }} />
            </g>
          );
        })}

        {/* 달마다 별 하나. 마우스를 올리면 값이 나온다. */}
        {months.map((month, index) =>
          month.total === null ? null : (
            <g key={month.label}>
              <title>{`${month.label}: ${formatScore(month.total)}${month.penalty ? " (보안사고 -50%)" : ""}`}</title>
              <circle cx={x(index)} cy={y(month.total)} r="9" fill="transparent" />
              <circle
                cx={x(index)}
                cy={y(month.total)}
                r={month.penalty ? 4.5 : 3}
                fill={month.penalty ? "#fb7185" : "#fff"}
                style={{ filter: `drop-shadow(0 0 5px ${month.penalty ? "#fb7185" : "#e879f9"})` }}
              />
            </g>
          ),
        )}

        {/* 이번 달 값 */}
        {ship && focusIndex >= 0 && (
          <text x={ship.x} y={ship.y - 26} textAnchor="middle" className="fill-white font-mono text-[12px] font-bold">
            {Math.round(months[focusIndex].total ?? 0).toLocaleString("ko-KR")}
          </text>
        )}

        {/* 우주선: 불꽃을 뒤로 내뿜으며 선 방향을 향한다 */}
        {ship && (
          <g transform={`translate(${ship.x} ${ship.y}) rotate(${shipAngle}) scale(1.5)`} style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,0.9))" }}>
            <path d="M-17,0 L-26,-4.5 L-26,4.5 Z" fill="#fbbf24" className="origin-right animate-pulse" />
            <path d="M-12,0 L-20,-2.4 L-20,2.4 Z" fill="#fff7ed" />
            <path d="M-4,-7 L5,-3 L-6,-12 Z" fill="#a5f3fc" />
            <path d="M-4,7 L5,3 L-6,12 Z" fill="#a5f3fc" />
            <path d="M-13,-3 L9,0 L-13,3 Z" fill="#f0fdfa" />
            <path d="M9,0 L1,-1.6 L1,1.6 Z" fill="#22d3ee" />
          </g>
        )}
      </svg>

      <p className="text-xs text-zinc-500">
        서비스 6개가 모두 계산된 달만 이어집니다. <span className="text-rose-300">붉은 별</span>은 보안사고 감점(-50%)이 반영된 달입니다.
      </p>
    </figure>
  );
}
