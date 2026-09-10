CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_id_cursor"
  ON "user_knowledge_items" ("user_id", "id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_approved_item_owner"
  ON "knowledge_card_drafts" ("user_id", "knowledge_item_id")
  WHERE "status" = 'approved' AND "approved_at" IS NOT NULL;
