// AI 인프라 지표 입력 (`/infra`) — 관리자만. 월 1회 직접 입력한다.
// Cache Components: searchParams와 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다.
import { Suspense } from "react";

import { requireAdmin } from "@/lib/auth/guard";
import { currentYearMonth } from "@/lib/date";
import { getDb } from "@/lib/db";
import { loadInfra } from "@/lib/infra";
import { YEAR_MONTH_PATTERN } from "@/lib/validation/inputs";

import { loadRoiInputs } from "@/lib/roi";

import { InfraForm } from "./infra-form";
import { RoiForm } from "./roi-form";

export default function InfraPage({ searchParams }: PageProps<"/infra">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <InfraContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InfraContent({ searchParams }: { searchParams: PageProps<"/infra">["searchParams"] }) {
  await requireAdmin();

  const { month } = await searchParams;
  const requested = typeof month === "string" ? month : "";
  const yearMonth = YEAR_MONTH_PATTERN.test(requested) ? requested : currentYearMonth();
  const snapshot = await loadInfra(getDb(), yearMonth);
  const roiValues = await loadRoiInputs(getDb());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">AI 인프라 지표 입력</h1>

      <form method="get" className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          월 선택
          <input
            type="month"
            name="month"
            defaultValue={yearMonth}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
          />
        </label>
        <button type="submit" className="rounded border border-zinc-400 px-3 py-2 text-sm">
          불러오기
        </button>
      </form>

      <InfraForm key={yearMonth} yearMonth={yearMonth} snapshot={snapshot} />

      <RoiForm values={roiValues} />
    </div>
  );
}
