-- 변경 이력(change_logs)은 쌓기만 하고 수정하거나 지우지 못하게 DB에서 막는다. (PRD 5번: 이전 값을 지우지 않는다)
CREATE FUNCTION "change_logs_block_modify"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '변경 이력은 수정하거나 지울 수 없습니다.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "change_logs_append_only" BEFORE UPDATE OR DELETE ON "change_logs" FOR EACH ROW EXECUTE FUNCTION "change_logs_block_modify"();
