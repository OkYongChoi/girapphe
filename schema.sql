-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Knowledge Cards Table
CREATE TABLE IF NOT EXISTS knowledge_cards (
  id TEXT PRIMARY KEY, -- meaningful code like 'kalman_filter', 'burg_entropy'
  title TEXT NOT NULL,
  summary TEXT,
  explanation TEXT,
  wiki_url TEXT,
  domain TEXT CHECK (domain IN ('signal', 'control', 'info', 'ml', 'other')),
  level TEXT CHECK (level IN ('memorize', 'understand', 'connect', 'apply')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Card States Table (Core Asset)
CREATE TABLE IF NOT EXISTS user_card_states (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES knowledge_cards(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('known', 'saved', 'unknown')),
  confidence INTEGER DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (user_id, card_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_card_states_user_id ON user_card_states(user_id);
CREATE INDEX IF NOT EXISTS idx_user_card_states_status ON user_card_states(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_domain ON knowledge_cards(domain);

-- Initial Seed Data (Example)
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
('burg_method', 'Burg Method', 'Maximum Entropy Spectral Estimation', 'Minimizes the forward and backward prediction errors...', 'https://en.wikipedia.org/wiki/Burg_method', 'signal', 'understand'),
('kalman_filter', 'Kalman Filter', 'Optimal estimation algorithm', 'Uses a series of measurements observed over time...', 'https://en.wikipedia.org/wiki/Kalman_filter', 'control', 'apply')
ON CONFLICT (id) DO NOTHING;
