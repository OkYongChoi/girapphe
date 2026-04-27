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
  domain TEXT CHECK (domain IN ('signal', 'control', 'info', 'ml', 'other')),
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
  content TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user
ON user_knowledge_items(user_id);

-- Initial Seed Data (Example)
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
('burg_method', 'Burg Method', 'Maximum Entropy Spectral Estimation', 'Minimizes the forward and backward prediction errors...', 'https://en.wikipedia.org/wiki/Burg_method', 'signal', 'understand'),
('kalman_filter', 'Kalman Filter', 'Optimal estimation algorithm', 'Uses a series of measurements observed over time...', 'https://en.wikipedia.org/wiki/Kalman_filter', 'control', 'apply')
ON CONFLICT (id) DO NOTHING;
