// Design Ref: §4.7 변경 이력 (`/history`) — 관리자만. 기간·대상 필터.
import { Suspense } from "react";

import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { targetLabel } from "@/lib/evidence/labels";
import { HISTORY_TARGETS, isDateString, loadHistory, type HistoryTarget } from "@/lib/history";

const LIMIT = 200;

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <HistoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HistoryContent({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  await requireAdmin();

  const params = await searchParams;
  const from = typeof params.from === "string" && isDateString(params.from) ? params.from : undefined;
  const to = typeof params.to === "string" && isDateString(params.to) ? params.to : undefined;
  const target =
    typeof params.target === "string" && (HISTORY_TARGETS as string[]).includes(params.target)
      ? (params.target as HistoryTarget)
      : undefined;

  const rows = await loadHistory(getDb(), { from, to, target, limit: LIMIT });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">변경 이력</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          시작일
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          종료일
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          대상
          <select
            name="target"
            defaultValue={target ?? ""}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          >
            <option value="">전체</option>
            {HISTORY_TARGETS.map((value) => (
              <option key={value} value={value}>
                {targetLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-400 px-3 py-2 text-sm">
          조회
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-3">변경 일시</th>
              <th className="py-2 pr-3">변경한 사람</th>
              <th className="py-2 pr-3">대상</th>
              <th className="py-2 pr-3">항목</th>
              <th className="py-2 pr-3">이전 값</th>
              <th className="py-2">새 값</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  조건에 맞는 변경 이력이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3 whitespace-nowrap">{row.changedAt}</td>
                <td className="py-2 pr-3">{row.changedByName}</td>
                <td className="py-2 pr-3">
                  {row.target} · {row.object}
                </td>
                <td className="py-2 pr-3">{row.field}</td>
                <td className="py-2 pr-3">{row.oldValue}</td>
                <td className="py-2">{row.newValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        최신 {LIMIT}건까지 보여줍니다. 변경 이력은 쌓기만 하며 수정하거나 지울 수 없습니다.
      </p>
    </div>
  );
}
