-- List and graph responses only need title and summary translations. Keep a
-- separate source hash so they can remain fresh without reading explanations.
ALTER TABLE "knowledge_card_translations"
  ADD COLUMN IF NOT EXISTS "list_source_hash" text;
--> statement-breakpoint
UPDATE "knowledge_card_translations" AS translation
SET "list_source_hash" = md5(
  COALESCE(card.title, '') || chr(31) || COALESCE(card.summary, '')
)
FROM "knowledge_cards" AS card
WHERE translation.card_id = card.id
  AND translation.list_source_hash IS NULL;
