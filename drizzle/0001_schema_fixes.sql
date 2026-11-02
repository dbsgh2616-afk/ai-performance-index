ALTER TABLE "monthly_inputs" DROP CONSTRAINT "monthly_inputs_year_month_ck";--> statement-breakpoint
ALTER TABLE "monthly_security" DROP CONSTRAINT "monthly_security_year_month_ck";--> statement-breakpoint
ALTER TABLE "survey_settings" DROP CONSTRAINT "survey_settings_year_ck";--> statement-breakpoint
ALTER TABLE "monthly_inputs" ALTER COLUMN "entered_by_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_security" ALTER COLUMN "entered_by_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_settings" ALTER COLUMN "entered_by_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_sort_order_uq" UNIQUE("sort_order");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_failed_count_ck" CHECK ("accounts"."failed_count" >= 0);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_session_version_ck" CHECK ("accounts"."session_version" >= 0);--> statement-breakpoint
ALTER TABLE "monthly_inputs" ADD CONSTRAINT "monthly_inputs_year_month_ck" CHECK ("monthly_inputs"."year_month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "monthly_security" ADD CONSTRAINT "monthly_security_year_month_ck" CHECK ("monthly_security"."year_month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_sort_order_ck" CHECK ("services"."sort_order" BETWEEN 1 AND 6);--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_grade_ck" CHECK ("survey_settings"."evidence_grade" = '설문 추정');--> statement-breakpoint
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_year_ck" CHECK ("survey_settings"."year" BETWEEN 2000 AND 2099);