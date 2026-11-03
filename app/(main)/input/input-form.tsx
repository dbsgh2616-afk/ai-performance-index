"use client";

import { useActionState } from "react";

import type { FormState } from "@/lib/form-state";
import type { MonthlyFormView } from "@/lib/inputs";

import { saveMonthlyAction } from "./actions";

const initialState: FormState = {};
const inputClass = "w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-600";

function formatDate(value: Date | null): string {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

export function InputForm({ yearMonth, view }: { yearMonth: string; view: MonthlyFormView }) {
  const [state, formAction, pending] = useActionState(saveMonthlyAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="yearMonth" value={yearMonth} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-3">서비스</th>
              <th className="py-2 pr-3">호출횟수</th>
              <th className="py-2 pr-3">근거 등급</th>
              <th className="py-2 pr-3">출처</th>
              <th className="py-2">마지막 입력</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.serviceId} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3 font-medium">{row.serviceName}</td>
                <td className="py-2 pr-3">
                  <input
                    name={`callCount-${row.serviceId}`}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    defaultValue={row.callCount ?? ""}
                    className={inputClass}
                    aria-label={`${row.serviceName} 호출횟수`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    실측
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`source-${row.serviceId}`}
                    type="text"
                    defaultValue={row.source ?? ""}
                    placeholder="예: 서비스 담당자 회신(11/5)"
                    className={inputClass}
                    aria-label={`${row.serviceName} 출처`}
                  />
                </td>
                <td className="py-2 text-xs text-zinc-500">
                  {row.enteredByName ? `${row.enteredByName} · ${formatDate(row.enteredAt)}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <legend className="px-2 text-sm font-medium">이 달 보안사고 (개인정보 유출 등)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="incident" defaultChecked={view.security?.incident ?? false} />
          보안사고가 있었다 (서비스 6개 합산 점수 50% 감점)
        </label>
        <input
          name="securitySource"
          type="text"
          defaultValue={view.security?.source ?? ""}
          placeholder="출처 (예: 정보보호팀 보고서)"
          className={inputClass}
          aria-label="보안사고 출처"
        />
        <p className="text-xs text-zinc-500">기록이 없는 달은 보안사고가 없는 것으로 봅니다.</p>
      </fieldset>

      <p className="text-xs text-zinc-500">
        호출횟수 칸이 빈 서비스는 저장하지 않으며, 그 달 지수는 &quot;데이터 없음&quot;으로 남습니다. 입력자와 입력 시각은
        로그인 정보로 자동 기록됩니다.
      </p>

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
          className="rounded bg-zinc-900 px-5 py-2 font-medium text-white disabled:opacity-60 dark:bg-fuchsia-500 dark:text-white dark:shadow-[0_0_16px_rgba(217,70,239,0.55)] dark:hover:bg-fuchsia-400"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
