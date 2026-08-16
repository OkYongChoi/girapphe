-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Knowledge Cards Table (legacy — kept for backward compatibility)
CREATE TABLE IF NOT EXISTS knowledge_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  explanation TEXT,
  wiki_url TEXT,
  domain TEXT,
  level TEXT CHECK (level IN ('memorize', 'understand', 'connect', 'apply')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Card States Table (legacy — kept for backward compatibility)
CREATE TABLE IF NOT EXISTS user_card_states (
  user_id TEXT NOT NULL,
  card_id TEXT REFERENCES knowledge_cards(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('known', 'saved', 'unknown')),
  self_report_label TEXT CHECK (self_report_label IN ('unknown', 'partial', 'explainable')),
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  confidence INTEGER DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, card_id)
);

-- ============================================================
-- NEW: Knowledge Graph Tables
-- ============================================================

-- 4. Graph Nodes Table
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  domain TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 5),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  type TEXT NOT NULL DEFAULT 'concept' CHECK (type IN ('concept', 'theorem', 'algorithm', 'model')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Graph Edges Table
CREATE TABLE IF NOT EXISTS graph_edges (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to')),
  weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (source, target, type)
);

-- 6. User Knowledge State Table
CREATE TABLE IF NOT EXISTS user_knowledge_states (
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  knowledge_state REAL NOT NULL DEFAULT 0 CHECK (knowledge_state IN (0, 0.5, 1)),
  self_report_level REAL NOT NULL DEFAULT 0 CHECK (self_report_level IN (0, 0.5, 1)),
  verified_level REAL NOT NULL DEFAULT 0 CHECK (verified_level IN (0, 0.5, 1)),
  source_type TEXT NOT NULL DEFAULT 'system'
    CHECK (source_type IN ('self_report', 'quiz', 'conversation', 'ai_inferred', 'system', 'migration')),
  confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  stability_score REAL NOT NULL DEFAULT 0 CHECK (stability_score >= 0 AND stability_score <= 1),
  retrieval_strength REAL NOT NULL DEFAULT 0 CHECK (retrieval_strength >= 0 AND retrieval_strength <= 1),
  explanation_strength REAL NOT NULL DEFAULT 0 CHECK (explanation_strength >= 0 AND explanation_strength <= 1),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_self_reported_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  first_known_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, node_id)
);

CREATE TABLE IF NOT EXISTS user_knowledge_evidence (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES knowledge_cards(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('self_report', 'quiz', 'conversation', 'ai_inferred', 'system', 'migration')),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('rated_card', 'self_report', 'quiz_pass', 'quiz_fail', 'review', 'bookmark', 'conversation', 'ai_inferred', 'migration')),
  score REAL,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_card_states_user_id ON user_card_states(user_id);
CREATE INDEX IF NOT EXISTS idx_user_card_states_status ON user_card_states(status);
CREATE INDEX IF NOT EXISTS idx_user_card_states_self_report_label ON user_card_states(self_report_label);
CREATE INDEX IF NOT EXISTS idx_user_card_states_is_bookmarked ON user_card_states(is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_domain ON knowledge_cards(domain);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_domain ON graph_nodes(domain);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_level ON graph_nodes(level);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target);
CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(type);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_states_user ON user_knowledge_states(user_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_states_node ON user_knowledge_states(node_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_states_source_type ON user_knowledge_states(source_type);

CREATE TABLE IF NOT EXISTS user_quiz_rate_limits (
  user_id TEXT PRIMARY KEY,
  next_allowed_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_evidence_user ON user_knowledge_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_evidence_node ON user_knowledge_evidence(node_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_evidence_source_type ON user_knowledge_evidence(source_type);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_evidence_event_type ON user_knowledge_evidence(event_type);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_evidence_created_at ON user_knowledge_evidence(created_at);

-- ============================================================
-- AUTH + USER KNOWLEDGE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  auth_provider TEXT,
  provider_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_provider_identity
ON auth_users(auth_provider, provider_user_id)
WHERE auth_provider IS NOT NULL AND provider_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_knowledge_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'general',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  purge_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user
ON user_knowledge_items(user_id);

CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_active_created
ON user_knowledge_items(user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_purge_at
ON user_knowledge_items(purge_at)
WHERE purge_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_knowledge_items_id_user_id
ON user_knowledge_items(id, user_id);

-- Private knowledge ingestion. Conversation providers can only submit review
-- drafts; approved cards remain in the owning user's graph overlay.
CREATE TABLE IF NOT EXISTS knowledge_ingestion_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'conversation' CHECK (source_type = 'conversation'),
  provider TEXT NOT NULL CHECK (provider IN ('chatgpt', 'claude', 'gemini', 'other')),
  scope TEXT NOT NULL DEFAULT 'current_conversation' CHECK (scope = 'current_conversation'),
  request_id TEXT NOT NULL,
  conversation_ref TEXT,
  mcp_token_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'approved', 'discarded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  committed_at TIMESTAMP WITH TIME ZONE,
  discarded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, provider, request_id)
);

CREATE TABLE IF NOT EXISTS knowledge_card_drafts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES knowledge_ingestion_batches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  client_card_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'general',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_relations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  knowledge_item_id TEXT REFERENCES user_knowledge_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (batch_id, client_card_id)
);

CREATE TABLE IF NOT EXISTS user_graph_nodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  knowledge_item_id TEXT NOT NULL REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'general',
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'conversation')),
  source_batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  purge_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, knowledge_item_id)
);

CREATE TABLE IF NOT EXISTS user_graph_edges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_private_node_id TEXT REFERENCES user_graph_nodes(id) ON DELETE CASCADE,
  source_public_node_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_private_node_id TEXT REFERENCES user_graph_nodes(id) ON DELETE CASCADE,
  target_public_node_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'related'
    CHECK (type IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to')),
  weight REAL NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'conversation')),
  source_batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  purge_at TIMESTAMP WITH TIME ZONE,
  CHECK (num_nonnulls(source_private_node_id, source_public_node_id) = 1),
  CHECK (num_nonnulls(target_private_node_id, target_public_node_id) = 1),
  CHECK ((source_private_node_id IS NULL OR source_private_node_id IS DISTINCT FROM target_private_node_id)
    AND (source_public_node_id IS NULL OR source_public_node_id IS DISTINCT FROM target_public_node_id))
);

CREATE TABLE IF NOT EXISTS knowledge_card_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  knowledge_item_id TEXT NOT NULL REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
  draft_id TEXT REFERENCES knowledge_card_drafts(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'conversation',
  provider TEXT NOT NULL,
  conversation_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (knowledge_item_id, draft_id)
);

-- Approved conversation cards keep their practice state separate from the
-- shared knowledge_cards catalogue. The composite foreign key prevents a state
-- row from ever linking one user's identity to another user's private item.
CREATE TABLE IF NOT EXISTS user_private_card_states (
  user_id TEXT NOT NULL,
  knowledge_item_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('known', 'saved')),
  knowledge_state TEXT NOT NULL CHECK (knowledge_state IN ('unknown', 'known')),
  progress_state TEXT NOT NULL CHECK (progress_state IN ('learning', 'review')),
  due_at TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, knowledge_item_id),
  CONSTRAINT user_private_card_states_item_owner_fk
    FOREIGN KEY (knowledge_item_id, user_id)
    REFERENCES user_knowledge_items(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT user_private_card_states_consistency_check
    CHECK (
      (status = 'known' AND knowledge_state = 'known' AND progress_state = 'review')
      OR
      (status = 'saved' AND knowledge_state = 'unknown' AND progress_state = 'learning')
    )
);

CREATE INDEX IF NOT EXISTS idx_user_private_card_states_user_status
ON user_private_card_states(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_private_card_states_user_due
ON user_private_card_states(user_id, due_at);

CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'MCP client',
  scopes JSONB NOT NULL DEFAULT '["knowledge:drafts:create"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS mcp_request_rate_limits (
  scope_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_ingestion_batches_user_created
ON knowledge_ingestion_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_ingestion_batches_token_created
ON knowledge_ingestion_batches(mcp_token_id, created_at DESC) WHERE mcp_token_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_user_status
ON knowledge_card_drafts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_user_created
ON knowledge_card_drafts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_batch
ON knowledge_card_drafts(batch_id);
CREATE INDEX IF NOT EXISTS idx_user_graph_nodes_user_active
ON user_graph_nodes(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_graph_nodes_purge_at
ON user_graph_nodes(purge_at) WHERE purge_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_graph_edges_user_active
ON user_graph_edges(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_graph_edges_source_private
ON user_graph_edges(source_private_node_id);
CREATE INDEX IF NOT EXISTS idx_user_graph_edges_target_private
ON user_graph_edges(target_private_node_id);
CREATE INDEX IF NOT EXISTS idx_user_graph_edges_purge_at
ON user_graph_edges(purge_at) WHERE purge_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_graph_edges_unique_active
ON user_graph_edges(
  user_id,
  COALESCE(source_private_node_id, 'public:' || source_public_node_id),
  COALESCE(target_private_node_id, 'public:' || target_public_node_id),
  type
) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_graph_edges_unique_symmetric_active
ON user_graph_edges(
  user_id,
  LEAST(
    COALESCE('private:' || source_private_node_id, 'public:' || source_public_node_id),
    COALESCE('private:' || target_private_node_id, 'public:' || target_public_node_id)
  ),
  GREATEST(
    COALESCE('private:' || source_private_node_id, 'public:' || source_public_node_id),
    COALESCE('private:' || target_private_node_id, 'public:' || target_public_node_id)
  ),
  type
) WHERE deleted_at IS NULL AND type IN ('related', 'equivalent_to');
CREATE INDEX IF NOT EXISTS idx_knowledge_card_sources_user_item
ON knowledge_card_sources(user_id, knowledge_item_id);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_user
ON mcp_access_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_active_hash
ON mcp_access_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_request_rate_limits_stale_credentials
ON mcp_request_rate_limits(updated_at, scope_key)
WHERE scope_key LIKE 'credential:%';

CREATE TABLE IF NOT EXISTS billing_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  toss_customer_key TEXT UNIQUE,
  trial_consumed_at TIMESTAMP WITH TIME ZONE,
  stripe_portal_window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  stripe_portal_request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_customers_stripe_portal_request_count_check
    CHECK (stripe_portal_request_count >= 0)
);

CREATE TABLE IF NOT EXISTS toss_prepare_rate_limits (
  user_id TEXT PRIMARY KEY,
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toss_prepare_rate_limits_updated_at
ON toss_prepare_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'toss', 'revenuecat')),
  provider_subscription_id TEXT NOT NULL,
  store TEXT CHECK (store IS NULL OR store IN ('web', 'app_store', 'play_store', 'stripe', 'promotional')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  entitlement TEXT NOT NULL DEFAULT 'ad_free' CHECK (entitlement = 'ad_free'),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  provider_event_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_subscriptions_provider_reference_key UNIQUE(provider, provider_subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_entitlement
ON billing_subscriptions(user_id, entitlement, status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end
ON billing_subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'revenuecat', 'toss')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_pending
ON billing_webhook_events(created_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS toss_billing_key_intents (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  provider_idempotency_key TEXT UNIQUE,
  auth_key_ciphertext TEXT,
  billing_key_ciphertext TEXT,
  billing_key_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'issuing'
    CHECK (status IN ('issuing', 'cleanup_pending', 'live', 'cleaned', 'manual_review')),
  issue_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_attempt_count >= 0),
  cleanup_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (cleanup_attempt_count >= 0),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_token TEXT,
  last_error_code TEXT,
  cleaned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT toss_billing_key_intents_id_agreement_user_key
    UNIQUE (id, agreement_id, user_id),
  CONSTRAINT toss_billing_key_intents_material_check CHECK (
    (status = 'issuing'
      AND provider_idempotency_key IS NOT NULL
      AND auth_key_ciphertext IS NOT NULL
      AND billing_key_ciphertext IS NULL
      AND billing_key_fingerprint IS NULL)
    OR (status IN ('cleanup_pending', 'live')
      AND auth_key_ciphertext IS NULL
      AND billing_key_ciphertext IS NOT NULL
      AND (billing_key_fingerprint IS NOT NULL
        OR (status = 'live' AND provider_idempotency_key IS NULL)))
    OR (status = 'cleaned'
      AND auth_key_ciphertext IS NULL
      AND billing_key_ciphertext IS NULL)
    OR (status = 'manual_review'
      AND provider_idempotency_key IS NOT NULL
      AND auth_key_ciphertext IS NULL
      AND billing_key_ciphertext IS NULL
      AND billing_key_fingerprint IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_key_intents_recovery
ON toss_billing_key_intents(status, updated_at)
WHERE status IN ('issuing', 'cleanup_pending');

CREATE INDEX IF NOT EXISTS idx_toss_billing_key_intents_agreement
ON toss_billing_key_intents(agreement_id, status);

CREATE TABLE IF NOT EXISTS toss_billing_agreements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  billing_key_ciphertext TEXT NOT NULL,
  billing_key_intent_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  next_charge_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_token TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  billing_key_cleanup_required BOOLEAN NOT NULL DEFAULT FALSE,
  billing_key_cleanup_attempts INTEGER NOT NULL DEFAULT 0 CHECK (billing_key_cleanup_attempts >= 0),
  billing_key_cleanup_last_error TEXT,
  billing_key_deleted_at TIMESTAMP WITH TIME ZONE,
  last_payment_key TEXT,
  last_order_id TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT toss_billing_agreements_intent_owner_fk
    FOREIGN KEY (billing_key_intent_id, id, user_id)
    REFERENCES toss_billing_key_intents(id, agreement_id, user_id)
    ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_toss_billing_agreements_due
ON toss_billing_agreements(next_charge_at)
WHERE next_charge_at IS NOT NULL AND cancel_at_period_end = FALSE;

CREATE INDEX IF NOT EXISTS idx_toss_billing_agreements_key_cleanup
ON toss_billing_agreements(updated_at)
WHERE billing_key_cleanup_required = TRUE;

CREATE TABLE IF NOT EXISTS toss_billing_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'consumed', 'failed', 'abandoned')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_sessions_user_status
ON toss_billing_sessions(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_toss_billing_sessions_cleanup
ON toss_billing_sessions(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_billing_sessions_one_pending
ON toss_billing_sessions(user_id)
WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS toss_billing_charges (
  order_id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES toss_billing_agreements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  cycle_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  amount_krw INTEGER NOT NULL CHECK (amount_krw > 0),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'applied', 'canceled', 'abandoned')),
  payment_key TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT toss_billing_charges_agreement_cycle_key UNIQUE(agreement_id, cycle_key),
  CONSTRAINT toss_billing_charges_period_check CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_charges_reconciliation
ON toss_billing_charges(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_billing_charges_one_unresolved
ON toss_billing_charges(agreement_id)
WHERE status IN ('pending', 'paid');

-- Initial Seed Data (Example)
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
('burg_method', 'Burg Method', 'Maximum Entropy Spectral Estimation', 'Minimizes the forward and backward prediction errors...', 'https://en.wikipedia.org/wiki/Burg_method', 'signal', 'understand'),
('kalman_filter', 'Kalman Filter', 'Optimal estimation algorithm', 'Uses a series of measurements observed over time...', 'https://en.wikipedia.org/wiki/Kalman_filter', 'control', 'apply')
ON CONFLICT (id) DO NOTHING;
