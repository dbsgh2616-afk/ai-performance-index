"use client";

import { useActionState } from "react";

import type { FormState } from "@/lib/form-state";
import { INFRA_GAUGES, type InfraSnapshot } from "@/lib/infra";

import { saveInfraAction } from "./actions";

const initialState: FormState = {};
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export function InfraForm({ yearMonth, snapshot }: { yearMonth: string; snapshot: InfraSnapshot | null }) {
  const [state, formAction, pending] = useActionState(saveInfraAction, initialState);

  return (
    <form action={formAction} className="glass flex flex-col gap-5 rounded-3xl p-6">
      <input type="hidden" name="yearMonth" value={yearMonth} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INFRA_GAUGES.map((gauge) => (
          <label key={gauge.key} className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {gauge.label} (%)
            <input
              name={gauge.key}
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              defaultValue={snapshot ? snapshot.values[gauge.key] : ""}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
        토큰 사용료 (원, 그 달에 낸 금액)
        <input name="token_cost" type="text" inputMode="numeric" defaultValue={snapshot ? String(snapshot.tokenCost) : ""} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        출처
        <input name="source" type="text" defaultValue={snapshot?.source ?? ""} placeholder="예: 인프라 모니터링 월간 보고" className={inputClass} />
      </label>

      <p className="text-xs text-zinc-500">
        {snapshot
          ? `마지막 입력: ${snapshot.enteredByName} · ${snapshot.enteredAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
          : "이 달에는 아직 입력된 값이 없습니다."}
      </p>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>그 달의 대표값(평균 등)을 % 로 입력합니다. 4개 값을 모두 채워야 저장됩니다.</li>
        <li>사용률·가동률은 계기판 경고등에, 토큰 사용료는 계기판과 추정 ROI의 비용에 쓰입니다. AI 성과지수 계산에는 들어가지 않습니다.</li>
        <li>저장하면 이전 값은 변경 이력에 남습니다.</li>
      </ul>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}
        >
          {state.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-6 py-2.5 font-medium text-white disabled:opacity-60 dark:bg-fuchsia-500 dark:text-white dark:shadow-[0_0_16px_rgba(217,70,239,0.55)] dark:hover:bg-fuchsia-400"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
