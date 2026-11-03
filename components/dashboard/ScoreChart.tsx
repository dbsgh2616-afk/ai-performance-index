// Design Ref: §4.4 월별 AI 지수 — 달마다 합계를 세로 게이지(튜브)로 보여준다. 입력이 없거나 6개가 다 계산되지 않은 달은 빈 튜브로 둔다.
import { formatScore } from "@/lib/format";

export type GaugeMonth = {
  label: string; // "1월"
  total: number | null; // 보안사고 감점이 반영된 합계. 계산할 수 없는 달은 null
  penalty: boolean; // 보안사고 감점이 적용된 달
  isFocus: boolean; // 요약 카드에 보이는 달
};

const TUBE_HEIGHT = "h-52";

export function ScoreChart({ months }: { months: GaugeMonth[] }) {
  const max = Math.max(1, ...months.map((month) => month.total ?? 0));

  return (
    <figure className="flex h-full flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/70">02 / Energy gauge</p>
        <figcaption className="mt-1 text-lg font-bold">월별 AI 지수</figcaption>
        <p className="text-xs text-zinc-500">달마다 서비스 6개의 합계입니다. 게이지가 찰수록 지수가 높습니다.</p>
      </div>

      <ol className="grid flex-1 grid-cols-12 items-end gap-1.5 sm:gap-2" aria-label="월별 AI 지수 게이지">
        {months.map((month) => {
          const percent = month.total === null ? 0 : Math.max(4, (month.total / max) * 100);
          return (
            <li key={month.label} className="flex min-w-0 flex-col items-center gap-2">
              <span
                className={`font-mono text-[10px] tabular-nums sm:text-[11px] ${
                  month.isFocus ? "font-bold text-white" : "text-zinc-400"
                }`}
              >
                {month.total === null ? "-" : Math.round(month.total).toLocaleString("ko-KR")}
              </span>

              {/* 튜브: 속이 빈 유리관 + 에너지가 차오르는 부분 */}
              <div
                className={`relative w-full max-w-[34px] overflow-hidden rounded-full border bg-white/[0.04] ${TUBE_HEIGHT} ${
                  month.isFocus ? "border-cyan-300/70 shadow-[0_0_18px_rgba(103,232,249,0.45)]" : "border-white/15"
                }`}
                title={month.total === null ? `${month.label}: 데이터 없음` : `${month.label}: ${formatScore(month.total)}${month.penalty ? " (보안사고 -50%)" : ""}`}
              >
                {/* 눈금 */}
                <div
                  className="absolute inset-0 opacity-40"
                  style={{ backgroundImage: "repeating-linear-gradient(to top, transparent 0 15%, rgba(255,255,255,0.18) 15% calc(15% + 1px))" }}
                  aria-hidden
                />
                {month.total !== null && (
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-full ${
                      month.penalty
                        ? "bg-gradient-to-t from-rose-700 via-rose-500 to-orange-300"
                        : "bg-gradient-to-t from-violet-700 via-fuchsia-500 to-cyan-300"
                    } shadow-[0_0_14px_rgba(217,70,239,0.7)]`}
                    style={{ height: `${percent}%` }}
                  >
                    {/* 게이지 끝의 밝은 점 */}
                    <span className="absolute inset-x-1 top-0.5 h-1.5 rounded-full bg-white/80 blur-[1px]" aria-hidden />
                  </div>
                )}
              </div>

              <span className={`text-[11px] ${month.isFocus ? "font-bold text-cyan-300" : "text-zinc-500"}`}>{month.label}</span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-zinc-500">
        서비스 6개가 모두 계산된 달만 채워집니다. <span className="text-rose-300">붉은 게이지</span>는 보안사고 감점(-50%)이 반영된 달입니다.
      </p>
    </figure>
  );
}
