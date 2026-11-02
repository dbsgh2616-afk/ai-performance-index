// Design Ref: §4.8 증적자료 출력 (`/evidence`) — 관리자만
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/DashboardView";
import { requireAdmin } from "@/lib/auth/guard";
import { currentYear, currentYearMonth } from "@/lib/date";
import { getDb } from "@/lib/db";
import { buildEvidenceReport } from "@/lib/evidence/report";

export default function EvidencePage({ searchParams }: PageProps<"/evidence">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <EvidenceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EvidenceContent({ searchParams }: { searchParams: PageProps<"/evidence">["searchParams"] }) {
  const admin = await requireAdmin();

  const params = await searchParams;
  const yearParam = typeof params.year === "string" ? Number(params.year) : NaN;
  const nowYear = currentYear();
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2099 ? yearParam : nowYear;

  const report = await buildEvidenceReport(getDb(), year, admin.name);
  const focusMonth = year === nowYear ? currentYearMonth() : `${year}-12`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">증적자료 출력</h1>

      <form method="get" className="flex items-end gap-2">
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
        <button type="submit" className="rounded border border-zinc-400 px-3 py-2 text-sm">
          미리보기
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/api/export/pdf?year=${year}`}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          PDF 내려받기
        </a>
        <a href={`/api/export/xlsx?year=${year}`} className="rounded border border-zinc-400 px-4 py-2 text-sm font-medium">
          엑셀 내려받기
        </a>
        <span className="text-xs text-zinc-500">파일에는 출력 일시와 출력자({admin.name})가 표시됩니다.</span>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>호출횟수 근거 {report.inputs.length}건 · 설정값 근거 {report.settings.length}건 · 보안사고 기록 {report.securityRecords.length}건</li>
        <li>
          출처가 없어 &quot;근거 미확인&quot;으로 표시되는 값:{" "}
          <strong className={report.unverifiedCount > 0 ? "text-red-600 dark:text-red-400" : ""}>{report.unverifiedCount}건</strong>
        </li>
        <li>{year}년 변경 이력 {report.changes.length}건이 파일에 들어갑니다.</li>
      </ul>

      <DashboardView yearScore={report.yearScore} focusMonth={focusMonth} focusLabel={year === nowYear ? "이번 달" : "12월"} isAdmin={false} />
    </div>
  );
}
