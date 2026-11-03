-- 모든 표에 행 수준 보안(RLS)을 켠다.
-- Supabase 같은 곳에서는 공개 키(anon)로 표를 REST 주소로 바로 읽고 쓸 수 있다. RLS를 켜고 정책을 만들지 않으면
-- 그런 접근은 모두 막힌다. 이 앱은 서버가 DB 소유자 계정으로 직접 접속하므로 RLS의 영향을 받지 않는다.
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthly_inputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthly_security" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "change_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "infra_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roi_inputs" ENABLE ROW LEVEL SECURITY;
