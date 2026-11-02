// Design Ref: §4.6 설문 설정값 (`/settings`) — 관리자만
import { Suspense } from "react";

import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { currentHalf, currentYear } from "@/lib/date";
import { loadSettingsForm } from "@/lib/inputs";
import type { Half } from "@/lib/score";

import { SettingsForm } from "./settings-form";

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await requireAdmin();

  const params = await searchParams;
  const yearParam = typeof params.year === "string" ? Number(params.year) : NaN;
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2099 ? yearParam : currentYear();
  const half: Half = params.half === "H1" || params.half === "H2" ? params.half : currentHalf();
  const rows = await loadSettingsForm(getDb(), year, half);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">설문 설정값</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          연도
          <input
            type="number"
            name="year"
            min={2000}
            max={2099}
            defaultValue={year}
            className="w-28 rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          반기
          <select
            name="half"
            defaultValue={half}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          >
            <option value="H1">상반기(1~6월) — 6월 조사 결과</option>
            <option value="H2">하반기(7~12월) — 12월 조사 결과</option>
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-400 px-3 py-2 text-sm">
          불러오기
        </button>
      </form>

      <SettingsForm key={`${year}-${half}`} year={year} half={half} rows={rows} />
    </div>
  );
}
