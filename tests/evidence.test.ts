// 작업 11·12: 증적자료(자료 모음, 엑셀, PDF)가 설계(DESIGN 4.8)대로 만들어지는지 확인한다.
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildEvidenceReport, type EvidenceReport } from "../lib/evidence/report";
import { buildEvidencePdf } from "../lib/evidence/pdf";
import { buildEvidenceXlsx } from "../lib/evidence/xlsx";
import { monthlyInputs, services } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";
import { saveMonthlyInputs } from "../lib/inputs";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;
let report: EvidenceReport;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
  await seedDev(db);

  const [first] = await db.select().from(services).orderBy(services.sortOrder).limit(1);
  const actor = { id: 1, name: "김관리" };
  // 출처가 없는 입력, 보안사고(출처 없음), 다른 연도의 입력을 만든다.
  await saveMonthlyInputs(
    db,
    { yearMonth: "2026-12", rows: [{ serviceId: first.id, callCount: 777, source: null }], security: { incident: true, source: null } },
    actor,
  );
  await saveMonthlyInputs(
    db,
    { yearMonth: "2025-12", rows: [{ serviceId: first.id, callCount: 1, source: "작년" }], security: { incident: false, source: null } },
    actor,
  );
  // 값을 고쳐서 변경 이력을 만든다.
  await saveMonthlyInputs(
    db,
    { yearMonth: "2026-12", rows: [{ serviceId: first.id, callCount: 800, source: null }], security: { incident: true, source: null } },
    { id: 2, name: "박담당" },
  );

  report = await buildEvidenceReport(db, 2026, "김관리", new Date("2026-11-02T07:05:00Z"));
});

afterAll(async () => {
  await close();
});

describe("증적자료 자료 모음", () => {
  it("출력 일시와 출력자를 담는다 (한국 시간)", () => {
    expect(report.printedAt).toBe("2026-11-02 16:05");
    expect(report.printedBy).toBe("김관리");
  });

  it("선택한 연도의 입력만 담고, 출처가 없으면 '근거 미확인'으로 표시한다", () => {
    expect(report.inputs.some((row) => row.yearMonth.startsWith("2025"))).toBe(false);
    const noSource = report.inputs.find((row) => row.yearMonth === "2026-12");
    expect(noSource?.source).toBe("근거 미확인");
    expect(noSource?.callCount).toBe(800);
    expect(report.securityRecords).toEqual([
      expect.objectContaining({ yearMonth: "2026-12", penalty: "50% 감점 적용", source: "근거 미확인" }),
    ]);
    // 입력 1건 + 보안사고 1건
    expect(report.unverifiedCount).toBe(2);
  });

  it("반기별 설정값 근거를 담는다", () => {
    expect(report.settings).toHaveLength(12);
    expect(report.settings[0]).toMatchObject({ grade: "설문 추정", period: "2026 상반기(1~6월)" });
  });

  it("선택한 연도의 변경 이력만 담고, 항목 이름은 한국어다", () => {
    const callCountChange = report.changes.find((row) => row.field === "호출횟수" && row.oldValue === "777");
    expect(callCountChange).toMatchObject({ newValue: "800", changedByName: "박담당" });
    expect(report.changes.some((row) => row.target.includes("2025"))).toBe(false);
  });

  it("지수 계산 결과(YearScore)를 담는다", () => {
    expect(report.yearScore.year).toBe(2026);
    expect(report.yearScore.countedMonths).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
});

describe("엑셀 증적자료", () => {
  it("시트 6개를 만들고, 출력 일시·출력자·'근거 미확인'·감점 표시가 들어 있다", async () => {
    const buffer = await buildEvidenceXlsx(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "요약",
      "서비스×월 지수",
      "호출횟수 근거",
      "설정값 근거",
      "보안사고",
      "변경 이력",
    ]);

    const text = (sheetName: string) => {
      const lines: string[] = [];
      workbook.getWorksheet(sheetName)?.eachRow((row) => lines.push((row.values as unknown[]).join("|")));
      return lines.join("\n");
    };

    expect(text("요약")).toContain("출력 일시: 2026-11-02 16:05");
    expect(text("요약")).toContain("출력자: 김관리");
    expect(text("호출횟수 근거")).toContain("근거 미확인");
    expect(text("보안사고")).toContain("50% 감점 적용");
    expect(text("서비스×월 지수")).toContain("데이터 없음");
    expect(text("변경 이력")).toContain("호출횟수");
  });
});

describe("PDF 증적자료", () => {
  it("PDF 파일을 만들고 한글 글꼴(Noto Sans KR)이 들어 있다", async () => {
    const buffer = await buildEvidencePdf(report);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(20_000);
    expect(buffer.toString("latin1")).toContain("NotoSansKR");
  });

  it("데이터가 하나도 없는 해에도 PDF가 만들어진다", async () => {
    await db.delete(monthlyInputs);
    const empty = await buildEvidenceReport(db, 2031, "김관리");
    const buffer = await buildEvidencePdf(empty);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
