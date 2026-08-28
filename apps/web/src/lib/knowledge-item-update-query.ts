export const KNOWLEDGE_ITEM_UPDATE_QUERY =
  `WITH current_item AS (
     SELECT * FROM user_knowledge_items
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND archived_at IS NULL
       AND version = $14
       AND NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions s
         WHERE s.user_id = user_knowledge_items.user_id
           AND s.superseded_item_id = user_knowledge_items.id
       )
   ), previous_revision AS (
     INSERT INTO knowledge_item_revisions
       (id, user_id, knowledge_item_id, version, snapshot, change_reason)
     SELECT $16, i.user_id, i.id, i.version, to_jsonb(i), 'before_manual_update'
     FROM current_item i
     ON CONFLICT (knowledge_item_id, version) DO NOTHING
   ), updated_item AS (
     UPDATE user_knowledge_items i SET title = $3, content = $4, topic = $5,
       tags = CASE WHEN $6::jsonb IS NULL THEN i.tags ELSE $6::jsonb END,
       summary = CASE WHEN $7::text IS NULL THEN i.summary ELSE $7 END,
       knowledge_type = CASE WHEN $9::boolean THEN $10 ELSE i.knowledge_type END,
       central_question = CASE WHEN $9::boolean THEN $11 ELSE i.central_question END,
       structured_content = CASE WHEN $9::boolean THEN $12::jsonb ELSE i.structured_content END,
       bundle_schema_version = CASE WHEN $9::boolean THEN $13 ELSE i.bundle_schema_version END,
       dedupe_key = $15, last_verified_at = NULL,
       version = i.version + 1, updated_at = NOW()
     FROM current_item current
     WHERE i.id = current.id AND i.user_id = current.user_id
     RETURNING i.*
   ), updated_revision AS (
     INSERT INTO knowledge_item_revisions
       (id, user_id, knowledge_item_id, version, snapshot, change_reason)
     SELECT $17, i.user_id, i.id, i.version, to_jsonb(i), 'manual_update'
     FROM updated_item i
     ON CONFLICT (knowledge_item_id, version) DO NOTHING
   ), inserted_activity AS (
     INSERT INTO knowledge_item_activity
       (id, user_id, knowledge_item_id, activity_type, metadata)
     SELECT $18, i.user_id, i.id, 'revised', '{"origin":"manual"}'::jsonb
     FROM updated_item i
   ), updated_node AS (
     UPDATE user_graph_nodes n SET label = i.title, topic = i.topic, updated_at = NOW()
     FROM updated_item i
     WHERE $8::boolean AND n.knowledge_item_id = i.id
       AND n.user_id = $2 AND n.deleted_at IS NULL
     RETURNING n.id
   )
   SELECT id FROM updated_item`;
