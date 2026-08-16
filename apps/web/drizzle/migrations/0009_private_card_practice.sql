CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_knowledge_items_id_user_id"
ON "user_knowledge_items" ("id", "user_id");

CREATE TABLE IF NOT EXISTS "user_private_card_states" (
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "status" text NOT NULL,
  "knowledge_state" text NOT NULL,
  "progress_state" text NOT NULL,
  "due_at" timestamp with time zone,
  "last_seen" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_private_card_states_user_id_knowledge_item_id_pk"
    PRIMARY KEY ("user_id", "knowledge_item_id"),
  CONSTRAINT "user_private_card_states_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items" ("id", "user_id")
    ON DELETE cascade,
  CONSTRAINT "user_private_card_states_status_check"
    CHECK ("status" IN ('known', 'saved')),
  CONSTRAINT "user_private_card_states_knowledge_state_check"
    CHECK ("knowledge_state" IN ('unknown', 'known')),
  CONSTRAINT "user_private_card_states_progress_state_check"
    CHECK ("progress_state" IN ('learning', 'review')),
  CONSTRAINT "user_private_card_states_consistency_check"
    CHECK (
      ("status" = 'known' AND "knowledge_state" = 'known' AND "progress_state" = 'review')
      OR
      ("status" = 'saved' AND "knowledge_state" = 'unknown' AND "progress_state" = 'learning')
    )
);

CREATE INDEX IF NOT EXISTS "idx_user_private_card_states_user_status"
ON "user_private_card_states" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "idx_user_private_card_states_user_due"
ON "user_private_card_states" ("user_id", "due_at");
