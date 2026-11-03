"use client";

import { useActionState } from "react";

import type { FormState } from "@/lib/form-state";
import { ROI_FIELDS, type RoiValues } from "@/lib/roi";

import { saveRoiAction } from "./actions";

const initialState: FormState = {};
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const GROUPS = [
  { id: "capex", title: "도입비용" },
  { id: "opex", title: "운영비·내용연수" },
  { id: "rate", title: "효과 환산 단가" },
] as const;

export function RoiForm({ values }: { values: Partial<RoiValues> | null }) {
  const [state, formAction, pending] = useActionState(saveRoiAction, initialState);

  return (
    <form action={formAction} className="glass flex flex-col gap-5 rounded-3xl p-6">
      <h2 className="text-lg font-bold">도입비용·운영비·단가 (ROI 계산용)</h2>

      {GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold text-fuchsia-300">{group.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROI_FIELDS.filter((field) => field.group === group.id).map((field) => (
              <label key={field.key} className="flex flex-col gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                {field.label} ({field.unit})
                <input
                  name={field.key}
                  type="text"
                  inputMode="numeric"
                  defaultValue={values?.[field.key] === undefined ? "" : String(values[field.key])}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        비용은 도입비용 합계를 내용연수로 나눈 월 상각비와 월 운영비를 더한 값입니다. 효과는 아낀 업무 시간에 시간당 단가를 곱한 값이라 추정 ROI입니다.
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
          className="rounded-md bg-zinc-900 px-6 py-2.5 font-medium text-white disabled:opacity-60 dark:bg-fuchsia-500 dark:text-white dark:shadow-[0_0_16px_rgba(217,70,239,0.55)] dark:hover:bg-fuchsia-400"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
