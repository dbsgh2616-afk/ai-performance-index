// Design Ref: §6 데이터 모델 — 표 6개(services, accounts, monthly_inputs, monthly_security, survey_settings, change_logs)
// Plan SC: 4 산출 근거 기록(입력자·일시·출처), 6 공통 산식 입력 기준
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// 권한: 관리자(admin)는 입력·수정·계정 관리, 조회자(viewer)는 조회만 한다.
export const roleEnum = pgEnum("role", ["admin", "viewer"]);

// 근거 등급: 호출횟수는 "실측", 업무절감시간·업무기여도는 "설문 추정"이다.
export const evidenceGradeEnum = pgEnum("evidence_grade", ["실측", "설문 추정"]);

// 반기: H1 = 1~6월(상반기), H2 = 7~12월(하반기)
export const halfEnum = pgEnum("half", ["H1", "H2"]);

// 변경 이력의 대상 종류
export const changeTargetEnum = pgEnum("change_target", [
  "monthly_input", // 월별 호출횟수
  "monthly_security", // 월별 보안사고
  "survey_setting", // 반기별 설문 설정값
  "account", // 계정
]);

// AI 서비스 6개. 추가·삭제 기능은 만들지 않는다. (PRD 6번)
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
});

// 계정. 비밀번호는 원문이 아니라 섞은 값(해시)만 저장한다. (PRD 7번)
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  loginId: text("login_id").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  // 비밀번호 재설정·계정 삭제 시 올려서 열려 있던 세션을 끊는다.
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 서비스+월마다 1줄. 입력자 번호(entered_by_id)는 계정과 연결하지 않는다.
// 계정을 진짜 삭제해도 입력 기록이 남아야 하기 때문이다. 이름은 따로 복사해 저장한다.
export const monthlyInputs = pgTable(
  "monthly_inputs",
  {
    id: serial("id").primaryKey(),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id),
    yearMonth: text("year_month").notNull(), // 예: 2026-11
    callCount: bigint("call_count", { mode: "number" }).notNull(),
    evidenceGrade: evidenceGradeEnum("evidence_grade").notNull().default("실측"),
    source: text("source"), // 출처가 없으면 증적자료에 "근거 미확인"으로 표시한다.
    enteredById: integer("entered_by_id"),
    enteredByName: text("entered_by_name").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("monthly_inputs_service_month_uq").on(t.serviceId, t.yearMonth),
    check("monthly_inputs_year_month_ck", sql`${t.yearMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("monthly_inputs_call_count_ck", sql`${t.callCount} >= 0`),
    // 호출횟수는 실측만 입력한다. (DESIGN 6.2)
    check("monthly_inputs_grade_ck", sql`${t.evidenceGrade} = '실측'`),
  ],
);

// 월마다 1줄. 보안사고가 있는 달은 서비스 6개 합산 점수를 50% 감점한다.
// 기록이 없는 달은 "사고 없음"으로 본다. (DESIGN 5.2)
export const monthlySecurity = pgTable(
  "monthly_security",
  {
    yearMonth: text("year_month").primaryKey(),
    incident: boolean("incident").notNull().default(false),
    source: text("source"),
    enteredById: integer("entered_by_id"),
    enteredByName: text("entered_by_name").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("monthly_security_year_month_ck", sql`${t.yearMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ],
);

// 서비스·반기마다 1줄. 고치면 덮어쓰고, 이전 값은 change_logs에 남긴다.
// 6월 조사 결과는 H1(1~6월), 12월 조사 결과는 H2(7~12월)의 모든 달에 적용한다.
export const surveySettings = pgTable(
  "survey_settings",
  {
    id: serial("id").primaryKey(),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id),
    year: integer("year").notNull(),
    half: halfEnum("half").notNull(),
    savedMinutes: numeric("saved_minutes", { precision: 10, scale: 2, mode: "number" }).notNull(), // 건당 업무절감시간(분)
    contributionPct: numeric("contribution_pct", { precision: 5, scale: 2, mode: "number" }).notNull(), // 업무기여도(%)
    // 보정계수: 호출횟수가 지나치게 높을 때 관리 차원에서 넣는 조정값이다. 기본 1.0 (효과 없음)
    correctionFactor: numeric("correction_factor", { precision: 8, scale: 4, mode: "number" })
      .notNull()
      .default(1),
    evidenceGrade: evidenceGradeEnum("evidence_grade").notNull().default("설문 추정"),
    source: text("source"),
    enteredById: integer("entered_by_id"),
    enteredByName: text("entered_by_name").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("survey_settings_service_period_uq").on(t.serviceId, t.year, t.half),
    check("survey_settings_year_ck", sql`${t.year} BETWEEN 2000 AND 2100`),
    check("survey_settings_saved_minutes_ck", sql`${t.savedMinutes} >= 0`),
    check("survey_settings_contribution_ck", sql`${t.contributionPct} BETWEEN 0 AND 100`),
    check("survey_settings_correction_ck", sql`${t.correctionFactor} > 0`),
  ],
);

// 모든 수정의 이전 값·새 값. 값을 고쳐도 이전 값을 지우지 않는다. (PRD 5번)
// 변경한 사람의 이름은 따로 복사해 저장해서, 계정이 삭제돼도 남는다.
export const changeLogs = pgTable("change_logs", {
  id: serial("id").primaryKey(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  targetType: changeTargetEnum("target_type").notNull(),
  targetId: text("target_id").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedByName: text("changed_by_name").notNull(),
});

export type Service = typeof services.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type MonthlyInput = typeof monthlyInputs.$inferSelect;
export type MonthlySecurity = typeof monthlySecurity.$inferSelect;
export type SurveySetting = typeof surveySettings.$inferSelect;
export type ChangeLog = typeof changeLogs.$inferSelect;
