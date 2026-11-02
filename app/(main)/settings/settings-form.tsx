"use client";

import { useActionState } from "react";

import { halfLabel } from "@/lib/date";
import type { FormState } from "@/lib/form-state";
import type { SettingsFormRow } from "@/lib/inputs";
import type { Half } from "@/lib/score";

import { saveSettingsAction } from "./actions";

const initialState: FormState = {};
const inputClass = "w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-600";

export function SettingsForm({ year, half, rows }: { year: number; half: Half; rows: SettingsFormRow[] }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="half" value={half} />

      <p className="text-sm">
        <strong>{halfLabel(year, half)}</strong>의 모든 달에 적용되는 값입니다.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-3">서비스</th>
              <th className="py-2 pr-3">업무절감시간(분/건)</th>
              <th className="py-2 pr-3">업무기여도(%)</th>
              <th className="py-2 pr-3">보정계수</th>
              <th className="py-2 pr-3">출처</th>
              <th className="py-2">마지막 입력</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serviceId} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3 font-medium">{row.serviceName}</td>
                <td className="py-2 pr-3">
                  <input
                    name={`savedMinutes-${row.serviceId}`}
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={row.savedMinutes ?? ""}
                    className={inputClass}
                    aria-label={`${row.serviceName} 업무절감시간`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`contributionPct-${row.serviceId}`}
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    defaultValue={row.contributionPct ?? ""}
                    className={inputClass}
                    aria-label={`${row.serviceName} 업무기여도`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`correctionFactor-${row.serviceId}`}
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={row.correctionFactor ?? ""}
                    placeholder="1"
                    className={inputClass}
                    aria-label={`${row.serviceName} 보정계수`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`settingSource-${row.serviceId}`}
                    type="text"
                    defaultValue={row.source ?? ""}
                    placeholder="예: 2026년 상반기 설문(응답 120명)"
                    className={inputClass}
                    aria-label={`${row.serviceName} 출처`}
                  />
                </td>
                <td className="py-2 text-xs text-zinc-500">
                  {row.enteredByName
                    ? `${row.enteredByName} · ${new Date(row.enteredAt as Date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>업무절감시간과 업무기여도는 &quot;설문 추정&quot; 값입니다. 근거 등급은 자동으로 &quot;설문 추정&quot;으로 저장됩니다.</li>
        <li>보정계수는 호출횟수가 지나치게 높을 때 관리 차원에서 넣는 조정값입니다. 비우면 1(효과 없음)로 저장됩니다.</li>
        <li>두 값이 모두 빈 서비스는 저장하지 않습니다.</li>
        <li>저장하면 선택한 반기의 모든 달 지수가 새 값으로 다시 계산됩니다. 이전 값은 변경 이력에 남습니다.</li>
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
          className="rounded bg-zinc-900 px-5 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
