// Design Ref: §3 기술 선택 — @react-pdf/renderer, 한글은 Noto Sans KR 글꼴 파일을 함께 넣어 깨지지 않게 한다.
// 글꼴 파일은 node_modules에서 읽는다. 배포 때 파일이 빠지지 않도록 next.config.ts의 outputFileTracingIncludes에 적어 두었다.
import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatMonthLabel, formatPercent, formatScore, NO_DATA } from "../format";
import type { EvidenceReport } from "./report";

const FONT_DIR = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "noto-sans-kr");
export const PDF_FONT_FAMILY = "NotoSansKR";

let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(FONT_DIR, "400Regular", "NotoSansKR_400Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "700Bold", "NotoSansKR_700Bold.ttf"), fontWeight: 700 },
    ],
  });
  // 한글은 단어 중간에서 줄이 바뀌어도 되므로 하이픈 처리를 끈다.
  Font.registerHyphenationCallback((word) => [word]);
  fontReady = true;
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 8, padding: 28, paddingBottom: 40 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 8, color: "#444444", marginBottom: 10 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 4 },
  summaryRow: { flexDirection: "row", marginBottom: 2 },
  summaryLabel: { width: 150, fontWeight: 700 },
  tableHeader: { flexDirection: "row", backgroundColor: "#E5E7EB", borderBottomWidth: 0.5, borderColor: "#999999" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#CCCCCC" },
  cell: { padding: 2 },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, fontSize: 7, color: "#666666", flexDirection: "row", justifyContent: "space-between" },
  warn: { color: "#B91C1C" },
});

type Column = { label: string; flex: number; align?: "left" | "right" };

function Table({ columns, rows, bold }: { columns: Column[]; rows: string[][]; bold?: number[] }) {
  return (
    <View>
      <View style={styles.tableHeader} wrap={false}>
        {columns.map((column) => (
          <Text key={column.label} style={[styles.cell, { flex: column.flex, textAlign: column.align ?? "left", fontWeight: 700 }]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.length === 0 && (
        <View style={styles.tableRow}>
          <Text style={styles.cell}>기록 없음</Text>
        </View>
      )}
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {row.map((value, columnIndex) => (
            <Text
              key={columnIndex}
              style={[
                styles.cell,
                { flex: columns[columnIndex].flex, textAlign: columns[columnIndex].align ?? "left" },
                bold?.includes(rowIndex) ? { fontWeight: 700 } : {},
                value === "근거 미확인" ? styles.warn : {},
              ]}
            >
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function EvidenceDocument({ report }: { report: EvidenceReport }) {
  const { yearScore } = report;
  const monthColumns: Column[] = yearScore.months.map((month) => ({
    label: formatMonthLabel(month.yearMonth),
    flex: 1,
    align: "right",
  }));

  const scoreRows = yearScore.months[0].services.map((service, index) => [
    service.serviceName,
    ...yearScore.months.map((month) => {
      const cell = month.services[index];
      return cell.score === null ? NO_DATA : formatScore(cell.score);
    }),
  ]);
  scoreRows.push([
    "합계",
    ...yearScore.months.map((month) =>
      month.total === null ? NO_DATA : `${formatScore(month.total)}${month.penaltyApplied ? " (-50%)" : ""}`,
    ),
  ]);

  return (
    <Document title={`AI 성과지수 증적자료 ${report.year}년`} author={report.printedBy}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>AI 성과지수 증적자료 {report.year}년</Text>
        <Text style={styles.meta}>
          출력 일시: {report.printedAt} · 출력자: {report.printedBy}
        </Text>

        <Text style={styles.h2}>요약</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>연간 누적 지수</Text>
          <Text>
            {yearScore.countedMonths.length === 0 ? NO_DATA : formatScore(yearScore.annualTotal)} ({yearScore.countedMonths.length}개월 합산)
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>합계를 내지 못한 달</Text>
          <Text>{yearScore.missingMonths.map(formatMonthLabel).join(", ") || "없음"}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>설문 추정 비중</Text>
          <Text>{formatPercent(yearScore.surveyShare)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>근거 미확인 건수</Text>
          <Text style={report.unverifiedCount > 0 ? styles.warn : {}}>{report.unverifiedCount}건</Text>
        </View>

        <Text style={styles.h2}>서비스×월 지수</Text>
        <Table
          columns={[{ label: "서비스", flex: 2.2 }, ...monthColumns]}
          rows={scoreRows}
          bold={[scoreRows.length - 1]}
        />
        <Text style={[styles.meta, { marginTop: 4 }]}>
          지수 = 호출횟수(실측) × 업무절감시간(분) × 업무기여도(%) × 보정계수. 서비스 6개가 모두 계산된 달만 합계를 내며, 보안사고가
          있는 달은 합계를 50% 감점합니다.
        </Text>

        <Text style={styles.h2}>호출횟수 근거</Text>
        <Table
          columns={[
            { label: "서비스", flex: 2 },
            { label: "월", flex: 1.2 },
            { label: "호출횟수", flex: 1.2, align: "right" },
            { label: "근거 등급", flex: 1.2 },
            { label: "출처", flex: 3 },
            { label: "입력자", flex: 1.4 },
            { label: "입력 일시", flex: 1.8 },
          ]}
          rows={report.inputs.map((row) => [
            row.serviceName,
            row.yearMonth,
            row.callCount.toLocaleString("ko-KR"),
            row.grade,
            row.source,
            row.enteredByName,
            row.enteredAt,
          ])}
        />

        <Text style={styles.h2}>설문 설정값 근거 (반기별)</Text>
        <Table
          columns={[
            { label: "서비스", flex: 1.6 },
            { label: "적용 반기", flex: 1.7 },
            { label: "절감시간(분)", flex: 1, align: "right" },
            { label: "기여도(%)", flex: 0.9, align: "right" },
            { label: "보정", flex: 0.7, align: "right" },
            { label: "응답자/대상", flex: 1.5 },
            { label: "응답률", flex: 0.9, align: "right" },
            { label: "조사 기간", flex: 2 },
            { label: "집계", flex: 1 },
            { label: "출처", flex: 2.6 },
            { label: "입력자", flex: 1.1 },
            { label: "입력 일시", flex: 1.5 },
          ]}
          rows={report.settings.map((row) => [
            row.serviceName,
            row.period,
            String(row.savedMinutes),
            String(row.contributionPct),
            String(row.correctionFactor),
            row.respondents,
            row.responseRate,
            row.surveyPeriod,
            row.aggregation,
            row.source,
            row.enteredByName,
            row.enteredAt,
          ])}
        />

        <Text style={styles.h2}>보안사고 기록</Text>
        <Table
          columns={[
            { label: "월", flex: 1.2 },
            { label: "보안사고", flex: 1 },
            { label: "감점", flex: 1.5 },
            { label: "출처", flex: 3 },
            { label: "입력자", flex: 1.4 },
            { label: "입력 일시", flex: 1.8 },
          ]}
          rows={report.securityRecords.map((row) => [
            row.yearMonth,
            row.incident ? "있음" : "없음",
            row.penalty,
            row.source,
            row.enteredByName,
            row.enteredAt,
          ])}
        />

        <Text style={styles.h2}>{report.year}년 변경 이력</Text>
        <Table
          columns={[
            { label: "변경 일시", flex: 1.6 },
            { label: "변경한 사람", flex: 1.2 },
            { label: "대상", flex: 3 },
            { label: "항목", flex: 1.4 },
            { label: "이전 값", flex: 1.4 },
            { label: "새 값", flex: 1.4 },
          ]}
          rows={report.changes.map((row) => [row.changedAt, row.changedByName, row.target, row.field, row.oldValue, row.newValue])}
        />

        <View style={styles.footer} fixed>
          <Text>
            AI 성과지수 증적자료 {report.year}년 · 출력 {report.printedAt} · 출력자 {report.printedBy}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function buildEvidencePdf(report: EvidenceReport): Promise<Buffer> {
  ensureFont();
  return renderToBuffer(<EvidenceDocument report={report} />);
}
