CREATE TYPE "public"."change_target" AS ENUM('monthly_input', 'monthly_security', 'survey_setting', 'account');--> statement-breakpoint
CREATE TYPE "public"."evidence_grade" AS ENUM('실측', '설문 추정');--> statement-breakpoint
CREATE TYPE "public"."half" AS ENUM('H1', 'H2');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'viewer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"login_id" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"password_hash" text NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
CREATE TABLE "change_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"target_type" "change_target" NOT NULL,
	"target_id" text NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_inputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"call_count" bigint NOT NULL,
	"evidence_grade" "evidence_grade" DEFAULT '실측' NOT NULL,
	"source" text,
	"entered_by_id" integer,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_inputs_service_month_uq" UNIQUE("service_id","year_month"),
	CONSTRAINT "monthly_inputs_year_month_ck" CHECK ("monthly_inputs"."year_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "monthly_inputs_call_count_ck" CHECK ("monthly_inputs"."call_count" >= 0),
	CONSTRAINT "monthly_inputs_grade_ck" CHECK ("monthly_inputs"."evidence_grade" = '실측')
);
--> statement-breakpoint
CREATE TABLE "monthly_security" (
	"year_month" text PRIMARY KEY NOT NULL,
	"incident" boolean DEFAULT false NOT NULL,
	"source" text,
	"entered_by_id" integer,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_security_year_month_ck" CHECK ("monthly_security"."year_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "services_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "survey_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"year" integer NOT NULL,
	"half" "half" NOT NULL,
	"saved_minutes" numeric(10, 2) NOT NULL,
	"contribution_pct" numeric(5, 2) NOT NULL,
	"correction_factor" numeric(8, 4) DEFAULT 1 NOT NULL,
	"evidence_grade" "evidence_grade" DEFAULT '설문 추정' NOT NULL,
	"source" text,
	"entered_by_id" integer,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_settings_service_period_uq" UNIQUE("service_id","year","half"),
	CONSTRAINT "survey_settings_year_ck" CHECK ("survey_settings"."year" BETWEEN 2000 AND 2100),
	CONSTRAINT "survey_settings_saved_minutes_ck" CHECK ("survey_settings"."saved_minutes" >= 0),
	CONSTRAINT "survey_settings_contribution_ck" CHECK ("survey_settings"."contribution_pct" BETWEEN 0 AND 100),
	CONSTRAINT "survey_settings_correction_ck" CHECK ("survey_settings"."correction_factor" > 0)
);
--> statement-breakpoint
ALTER TABLE "monthly_inputs" ADD CONSTRAINT "monthly_inputs_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;