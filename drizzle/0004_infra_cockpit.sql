ALTER TYPE "public"."change_target" ADD VALUE 'infra_metric';--> statement-breakpoint
CREATE TABLE "infra_metrics" (
	"year_month" text PRIMARY KEY NOT NULL,
	"gpu_usage_pct" numeric(5, 2) NOT NULL,
	"memory_usage_pct" numeric(5, 2) NOT NULL,
	"storage_usage_pct" numeric(5, 2) NOT NULL,
	"uptime_pct" numeric(5, 2) NOT NULL,
	"source" text,
	"entered_by_id" integer NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infra_metrics_year_month_ck" CHECK ("infra_metrics"."year_month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "infra_metrics_gpu_ck" CHECK ("infra_metrics"."gpu_usage_pct" between 0 and 100),
	CONSTRAINT "infra_metrics_memory_ck" CHECK ("infra_metrics"."memory_usage_pct" between 0 and 100),
	CONSTRAINT "infra_metrics_storage_ck" CHECK ("infra_metrics"."storage_usage_pct" between 0 and 100),
	CONSTRAINT "infra_metrics_uptime_ck" CHECK ("infra_metrics"."uptime_pct" between 0 and 100)
);
