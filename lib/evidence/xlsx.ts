// Design Ref: §4.8 증적자료 엑셀 — PDF와 같은 자료(EvidenceReport)를 시트별로 담는다.
import ExcelJS from "exceljs";

import { formatMonthLabel, formatPercent, NO_DATA } from "../format";
import type { EvidenceReport } from "./report";

function addSheet(
  workbook: ExcelJS.Workbook,
  report: EvidenceReport,
  name: string,
  header: string[],
  rows: (string | number)[][],
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow([`AI 성과지수 증적자료 ${report.year}년 — ${name}`]).font = { bold: true, size: 13 };
  sheet.addRow([`출력 일시: ${report.printedAt}`, `출력자: ${report.printedBy}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(header);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column, index) => {
    const longest = Math.max(header[index]?.length ?? 0, ...rows.map((row) => String(row[index] ?? "").length));
    column.width = Math.min(Math.max(longest + 4, 10), 50);
  });
  return sheet;
}

export async function buildEvidenceXlsx(report: EvidenceReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.printedBy;
  workbook.created = new Date();

  const { yearScore } = report;

  addSheet(workbook, report, "요약", ["항목", "값"], [
    ["연도", report.year],
    [`연간 누적 지수 (${yearScore.countedMonths.length}개월 합산)`, yearScore.countedMonths.length === 0 ? NO_DATA : yearScore.annualTotal],
    ["합계를 내지 못한 달", yearScore.missingMonths.map(formatMonthLabel).join(", ") || "없음"],
    ["설문 추정 비중", formatPercent(yearScore.surveyShare)],
    ["근거 미확인 건수", report.unverifiedCount],
    ["출력 일시", report.printedAt],
    ["출력자", report.printedBy],
  ]);

  const services = yearScore.months[0].services;
  const monthHeader = yearScore.months.map((month) => formatMonthLabel(month.yearMonth));
  const scoreRows: (string | number)[][] = services.map((service, index) => [
    service.serviceName,
    ...yearScore.months.map((month) => {
      const cell = month.services[index];
      return cell.score === null ? NO_DATA : Math.round(cell.score * 10) / 10;
    }),
  ]);
  scoreRows.push([
    "합계(감점 후)",
    ...yearScore.months.map((month) => (month.total === null ? NO_DATA : Math.round(month.total * 10) / 10)),
  ]);
  scoreRows.push(["보안사고 감점", ...yearScore.months.map((month) => (month.penaltyApplied ? "50% 감점" : "-"))]);
  addSheet(workbook, report, "서비스×월 지수", ["서비스", ...monthHeader], scoreRows);

  addSheet(
    workbook,
    report,
    "호출횟수 근거",
    ["서비스", "월", "호출횟수", "근거 등급", "출처", "입력자", "입력 일시"],
    report.inputs.map((row) => [row.serviceName, row.yearMonth, row.callCount, row.grade, row.source, row.enteredByName, row.enteredAt]),
  );

  addSheet(
    workbook,
    report,
    "설정값 근거",
    ["서비스", "적용 반기", "업무절감시간(분)", "업무기여도(%)", "보정계수", "근거 등급", "출처", "입력자", "입력 일시"],
    report.settings.map((row) => [
      row.serviceName,
      row.period,
      row.savedMinutes,
      row.contributionPct,
      row.correctionFactor,
      row.grade,
      row.source,
      row.enteredByName,
      row.enteredAt,
    ]),
  );

  addSheet(
    workbook,
    report,
    "보안사고",
    ["월", "보안사고", "감점", "출처", "입력자", "입력 일시"],
    report.securityRecords.map((row) => [
      row.yearMonth,
      row.incident ? "있음" : "없음",
      row.penalty,
      row.source,
      row.enteredByName,
      row.enteredAt,
    ]),
  );

  addSheet(
    workbook,
    report,
    "변경 이력",
    ["변경 일시", "변경한 사람", "대상", "항목", "이전 값", "새 값"],
    report.changes.map((row) => [row.changedAt, row.changedByName, row.target, row.field, row.oldValue, row.newValue]),
  );

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
