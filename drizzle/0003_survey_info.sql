CREATE TYPE "public"."aggregation_method" AS ENUM('mean', 'median', 'trimmed_mean');--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "respondent_count" integer;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "target_count" integer;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "survey_start" date;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "survey_end" date;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "aggregation" "aggregation_method";--> statement-breakpoint
ALTER TABLE "survey_settings" ADD COLUMN "question_text" text;--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_respondent_ck" CHECK ("survey_settings"."respondent_count" IS NULL OR "survey_settings"."respondent_count" >= 0);--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_target_ck" CHECK ("survey_settings"."target_count" IS NULL OR "survey_settings"."target_count" > 0);--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_response_ck" CHECK ("survey_settings"."respondent_count" IS NULL OR "survey_settings"."target_count" IS NULL OR "survey_settings"."respondent_count" <= "survey_settings"."target_count");--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_period_ck" CHECK ("survey_settings"."survey_start" IS NULL OR "survey_settings"."survey_end" IS NULL OR "survey_settings"."survey_end" >= "survey_settings"."survey_start");