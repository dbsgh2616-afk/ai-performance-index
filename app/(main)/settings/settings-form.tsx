"use client";

import { useActionState, useState } from "react";

import { halfLabel } from "@/lib/date";
import type { FormState } from "@/lib/form-state";
import type { SettingsFormRow } from "@/lib/inputs";
import type { Half } from "@/lib/score";
import { AGGREGATION_OPTIONS, formatResponseRate } from "@/lib/survey";

import { saveSettingsAction } from "./actions";

const initialState: FormState = {};
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

function toText(value: number | null): string {
  return value === null ? "" : String(value);
}

function ServiceCard({ row }: { row: SettingsFormRow }) {
  const id = row.serviceId;
  // 응답률은 입력하는 동안 바로 계산해서 보여준다.
  const [respondents, setRespondents] = useState(toText(row.respondentCount));
  const [target, setTarget] = useState(toText(row.targetCount));
  const rate = formatResponseRate(
    respondents === "" ? null : Number(respondents),
    target === "" ? null : Number(target),
  );

  return (
    <fieldset className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <legend className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
        {row.serviceName}
      </legend>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          업무절감시간 (분/건)
          <input name={`savedMinutes-${id}`} type="number" min={0} step="any" defaultValue={toText(row.savedMinutes)} className={inputClass} />
        </label>
        <label className={labelClass}>
          업무기여도 (%)
          <input name={`contributionPct-${id}`} type="number" min={0} max={100} step="any" defaultValue={toText(row.contributionPct)} className={inputClass} />
        </label>
        <label className={labelClass}>
          보정계수 (비우면 1)
          <input name={`correctionFactor-${id}`} type="number" min={0} step="any" defaultValue={toText(row.correctionFactor)} placeholder="1" className={inputClass} />
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/40">
        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">설문 정보 (이 값이 어떤 조사에서 나왔는지)</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className={labelClass}>
            응답자 수 (명)
            <input
              name={`respondentCount-${id}`}
              type="number"
              min={1}
              step={1}
              value={respondents}
              onChange={(event) => setRespondents(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            대상 인원 (명)
            <input
              name={`targetCount-${id}`}
              type="number"
              min={1}
              step={1}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className={inputClass}
            />
          </label>
          <div className={labelClass}>
            응답률 (자동 계산)
            <p className="rounded-md bg-white px-3 py-2 text-sm font-bold text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">{rate}</p>
          </div>
          <label className={labelClass}>
            집계 방식
            <select name={`aggregation-${id}`} defaultValue={row.aggregation ?? ""} className={inputClass}>
              <option value="">선택</option>
              {AGGREGATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} title={option.hint}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            조사 시작일
            <input name={`surveyStart-${id}`} type="date" defaultValue={row.surveyStart ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            조사 종료일
            <input name={`surveyEnd-${id}`} type="date" defaultValue={row.surveyEnd ?? ""} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          설문 문항 원문 (선택)
          <textarea name={`question-${id}`} rows={2} defaultValue={row.questionText ?? ""} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        출처
        <input name={`settingSource-${id}`} type="text" defaultValue={row.source ?? ""} placeholder="예: 2026년 상반기 이용자 설문" className={inputClass} />
      </label>

      <p className="text-xs text-zinc-500">
        {row.enteredByName
          ? `마지막 입력: ${row.enteredByName} · ${new Date(row.enteredAt as Date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
          : "아직 입력된 값이 없습니다."}
      </p>
    </fieldset>
  );
}

export function SettingsForm({ year, half, rows }: { year: number; half: Half; rows: SettingsFormRow[] }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="half" value={half} />

      <p className="text-sm">
        <strong>{halfLabel(year, half)}</strong>의 모든 달에 적용되는 값입니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {rows.map((row) => (
          <ServiceCard key={row.serviceId} row={row} />
        ))}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>업무절감시간과 업무기여도는 &quot;설문 추정&quot; 값입니다. 근거 등급은 자동으로 &quot;설문 추정&quot;으로 저장됩니다.</li>
        <li>설문 정보(응답자 수, 대상 인원, 조사 기간, 집계 방식)는 값을 입력하는 서비스마다 반드시 채워야 합니다. 증적자료에 함께 나옵니다.</li>
        <li>보정계수는 호출횟수가 지나치게 높을 때 관리 차원에서 넣는 조정값입니다. 비우면 1(효과 없음)로 저장됩니다.</li>
        <li>모든 칸이 빈 서비스는 저장하지 않습니다.</li>
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
          className="rounded-md bg-zinc-900 px-6 py-2.5 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
