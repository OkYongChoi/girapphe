ALTER TABLE knowledge_cards
  DROP CONSTRAINT IF EXISTS knowledge_cards_domain_check;

DELETE FROM knowledge_cards
WHERE id LIKE 'graph_adv_%'
   OR title ILIKE 'Sponsored Content %';

DELETE FROM graph_nodes
WHERE type = 'advertisement'
   OR label ILIKE 'Sponsored Content %';
