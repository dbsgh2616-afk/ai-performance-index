// Design Ref: §4.5 월별 데이터 입력 (`/input`) — 관리자만
// Cache Components: searchParams와 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다.
import { Suspense } from "react";

import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { currentYearMonth } from "@/lib/date";
import { loadMonthlyForm } from "@/lib/inputs";
import { YEAR_MONTH_PATTERN } from "@/lib/validation/inputs";

import { InputForm } from "./input-form";

export default function InputPage({ searchParams }: PageProps<"/input">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <InputContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InputContent({ searchParams }: { searchParams: PageProps<"/input">["searchParams"] }) {
  await requireAdmin();

  const { month } = await searchParams;
  const requested = typeof month === "string" ? month : "";
  const yearMonth = YEAR_MONTH_PATTERN.test(requested) ? requested : currentYearMonth();
  const view = await loadMonthlyForm(getDb(), yearMonth);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">월별 데이터 입력</h1>

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

      <InputForm key={yearMonth} yearMonth={yearMonth} view={view} />
    </div>
  );
}
