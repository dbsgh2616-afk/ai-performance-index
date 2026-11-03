ALTER TYPE "public"."change_target" ADD VALUE 'roi_input';--> statement-breakpoint
CREATE TABLE "roi_inputs" (
	"key" text PRIMARY KEY NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"entered_by_id" integer NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL
);
