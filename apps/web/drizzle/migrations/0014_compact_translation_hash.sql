-- List and graph responses only need title and summary translations. Keep a
-- separate source hash so they can remain fresh without reading explanations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "knowledge_card_translations"
  ADD COLUMN IF NOT EXISTS "list_source_hash" text;
--> statement-breakpoint
UPDATE "knowledge_card_translations" AS translation
SET "list_source_hash" = md5(
  COALESCE(card.title, '') || chr(31) || COALESCE(card.summary, '')
)
FROM "knowledge_cards" AS card
WHERE translation.card_id = card.id
  AND translation.list_source_hash IS NULL
  -- Do not mark a translation current when its original full source is stale.
  AND translation.source_hash = encode(
    digest(
      convert_to(COALESCE(card.title, ''), 'UTF8')
      || decode('00', 'hex')
      || convert_to(COALESCE(card.summary, ''), 'UTF8')
      || decode('00', 'hex')
      || convert_to(COALESCE(card.explanation, ''), 'UTF8')
      || decode('00', 'hex'),
      'sha256'
    ),
    'hex'
  );
