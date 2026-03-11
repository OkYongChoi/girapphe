'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';
import { GRAPH_EDGES } from '@/data/graph-edges';
import { GRAPH_NODES } from '@/data/graph-nodes';
import { CARD_CONTENT } from '@/data/card-content';
import { getCardLevelMeta, type CardLevel } from '@/lib/card-level';

export type KnowledgeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  level: CardLevel;
  related_concepts?: string[];
  suggest_reason?: string;
};

export type CardStatus = 'known' | 'saved';
type CardKnowledgeState = 'unknown' | 'known';
type CardProgressState = 'new' | 'learning' | 'review';
export type QuizChoiceSet = [string, string, string, string];

export type NodeQuiz = {
  nodeId: string;
  question: string;
  choices: QuizChoiceSet;
  correctAnswerIndex: 0 | 1 | 2 | 3;
};

type CardWithStatusRow = KnowledgeCard & {
  status: CardStatus | null;
  knowledge_state?: CardKnowledgeState | null;
  progress_state?: CardProgressState | null;
  due_at?: Date | null;
  last_seen?: Date | null;
};

type LeaderboardRow = {
  user_id: string;
  known_count: string;
  total_count: string;
};

// Bump this whenever CARD_CONTENT changes to force a DB refresh
const CARD_CONTENT_VERSION = '6';

let cardSchemaReady = false;
let cardSchemaPromise: Promise<void> | null = null;

const BASE_MOCK_CARDS: KnowledgeCard[] = [
  {
    id: 'burg_method',
    title: 'Burg Method',
    summary: 'MaxEnt Spectral Estimation',
    explanation:
      'Minimizes forward & backward prediction errors.\n\nKey Benefit:\nHigh resolution for short data records (unlike FFT).\n\nConstraint:\nAlways guarantees a stable filter.',
    wiki_url: 'https://en.wikipedia.org/wiki/Burg_method',
    domain: 'signal',
    level: 'understand',
    related_concepts: ['Autoregressive Model', 'Spectral Density', 'Levinson Recursion'],
  },
  {
    id: 'kalman_filter',
    title: 'Kalman Filter',
    summary: 'Optimal Recursive Linear Estimator',
    explanation:
      '$$x_k = A\\,x_{k-1} + B\\,u_k + w_k$$\n$$z_k = H\\,x_k + v_k$$\n\n1. Predict:\n$$\\hat{x}_k = A\\,\\hat{x}_{k-1} + B\\,u_k$$\n$$P_k = A\\,P_{k-1}\\,A^T + Q$$\n\n2. Update:\n$$K_k = P_k H^T\\!(H P_k H^T + R)^{-1}$$\n$$\\hat{x}_k^{\\,+} = \\hat{x}_k + K_k(z_k - H\\,\\hat{x}_k)$$',
    wiki_url: 'https://en.wikipedia.org/wiki/Kalman_filter',
    domain: 'control',
    level: 'apply',
    related_concepts: ['Bayesian Inference', 'Hidden Markov Model', 'Control Theory'],
  },
  {
    id: 'nyquist_shannon',
    title: 'Nyquist-Shannon Theorem',
    summary: 'Sampling Rate Requirement',
    explanation:
      '$$f_s > 2 \\cdot f_{\\max}$$\n\nIf $f_s < 2\\,f_{\\max}$:\nAliasing occurs (high freq appears as low freq).\n\nNyquist Frequency $= f_s \\,/\\, 2$',
    wiki_url: 'https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem',
    domain: 'signal',
    level: 'memorize',
    related_concepts: ['Aliasing', 'Fourier Transform', 'Quantization'],
  },
  {
    id: 'transformer_model',
    title: 'Transformer Architecture',
    summary: 'Attention-based Sequence Model',
    explanation:
      '$$\\text{Attention}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\nKey Innovation:\nReplaces recurrence with Self-Attention, allowing massive parallelization.\n\nKey Components:\n- Multi-Head Attention\n- Positional Encoding\n- Feed-Forward Networks',
    wiki_url: 'https://en.wikipedia.org/wiki/Transformer_(machine_learning_model)',
    domain: 'ml',
    level: 'understand',
    related_concepts: ['Self-Attention', 'Positional Encoding', 'BERT', 'GPT'],
  },
];

const EDGE_MAP = GRAPH_EDGES.reduce<Record<string, string[]>>((acc, edge) => {
  if (!acc[edge.source]) acc[edge.source] = [];
  if (!acc[edge.target]) acc[edge.target] = [];
  acc[edge.source].push(edge.target);
  acc[edge.target].push(edge.source);
  return acc;
}, {});

function mapGraphDomainToCardDomain(domain: string): KnowledgeCard['domain'] {
  const key = domain.toLowerCase();
  // Signal / Control
  if (key.includes('control')) return 'control';
  if (key.includes('signal')) return 'signal';
  // ML / AI family (check vision/nlp before 'computer' to ensure Computer Vision → ml)
  if (key.includes('machine') || key.includes('learning') || key.includes('intelligence')) return 'ml';
  if (key.includes('vision') || key === 'nlp' || key.includes('natural language')) return 'ml';
  if (key.includes('ai safety') || key.includes('federated') || key.includes('alignment')) return 'ml';
  // Info / CS
  if (key.includes('algorithm') || key.includes('compiler') || key.includes('database')) return 'info';
  if (key.includes('computer') || key.includes('data') || key.includes('architecture')) return 'info';
  if (key === 'os' || key.includes('operating') || key.includes('security')) return 'info';
  if (key.includes('cloud') || key.includes('devops') || key.includes('network')) return 'info';
  if (key.includes('software') || key.includes('programming') || key.includes('distributed')) return 'info';
  if (key.includes('theoretical')) return 'info';
  // Physics, Chemistry, Biology, Materials, Instrumentation, IoT, Complex Systems, etc. → other
  return 'other';
}

function mapDifficultyToLevel(difficulty: number): CardLevel {
  if (difficulty <= 1) return 'memorize';
  if (difficulty <= 2) return 'understand';
  if (difficulty <= 3) return 'connect';
  return 'apply';
}

const GENERATED_MOCK_CARDS: KnowledgeCard[] = GRAPH_NODES
  .filter((node) => node.level > 0 && node.id in CARD_CONTENT)
  .map((node) => {
    const related = (EDGE_MAP[node.id] ?? [])
      .map((id) => GRAPH_NODES.find((candidate) => candidate.id === id)?.label)
      .filter((label): label is string => Boolean(label))
      .slice(0, 4);

    const content = CARD_CONTENT[node.id];
    return {
      id: `graph_${node.id}`,
      title: node.label,
      summary: content?.summary ?? `${node.type} in ${node.domain}`,
      explanation: content?.explanation ?? [
        `Domain: ${node.domain}`,
        `Difficulty: ${node.difficulty}/5`,
        `Type: ${node.type}`,
      ].join('\n'),
      wiki_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(node.label.replace(/\s+/g, '_'))}`,
      domain: mapGraphDomainToCardDomain(node.domain),
      level: mapDifficultyToLevel(node.difficulty),
      related_concepts: related,
    };
  });

const MOCK_CARDS: KnowledgeCard[] = [
  ...BASE_MOCK_CARDS,
  ...GENERATED_MOCK_CARDS.filter((generated) => !BASE_MOCK_CARDS.some((base) => base.id === generated.id)),
];

const NODE_BY_ID = new Map(GRAPH_NODES.map((node) => [node.id, node]));
const CARDS_BY_ID = new Map(MOCK_CARDS.map((card) => [card.id, card]));
const UNIQUE_DOMAINS = Array.from(new Set(GRAPH_NODES.map((node) => node.domain)));
const PREREQ_INCOMING = new Map<string, string[]>();
const PREREQ_OUTGOING = new Map<string, string[]>();

function withRelatedConcepts<T extends { id: string; related_concepts?: string[] | null }>(card: T) {
  if (card.related_concepts && card.related_concepts.length > 0) return card;
  const related = CARDS_BY_ID.get(card.id)?.related_concepts;
  if (!related || related.length === 0) return card;
  return { ...card, related_concepts: related };
}

for (const edge of GRAPH_EDGES) {
  if (edge.type !== 'prerequisite') continue;
  const incoming = PREREQ_INCOMING.get(edge.target) ?? [];
  incoming.push(edge.source);
  PREREQ_INCOMING.set(edge.target, incoming);

  const outgoing = PREREQ_OUTGOING.get(edge.source) ?? [];
  outgoing.push(edge.target);
  PREREQ_OUTGOING.set(edge.source, outgoing);
}

async function ensureCardSchema() {
  if (!process.env.DATABASE_URL) return;
  if (cardSchemaReady) return;
  if (cardSchemaPromise) return cardSchemaPromise;
  cardSchemaPromise = _initCardSchema();
  return cardSchemaPromise;
}

async function _initCardSchema() {

  // schema_meta table stores versioned key-value pairs so we can detect
  // when card content has changed and force a re-seed of knowledge_cards.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_card_states (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
      status TEXT CHECK (status IN ('known', 'saved')),
      knowledge_state TEXT CHECK (knowledge_state IN ('unknown', 'known')),
      progress_state TEXT CHECK (progress_state IN ('new', 'learning', 'review')),
      due_at TIMESTAMP WITH TIME ZONE,
      confidence INTEGER DEFAULT 0,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, card_id)
    );
  `);

  // Backward-compatible migration: old deployments only had "status".
  await pool.query(`
    ALTER TABLE user_card_states
      ADD COLUMN IF NOT EXISTS knowledge_state TEXT CHECK (knowledge_state IN ('unknown', 'known'));
  `);
  await pool.query(`
    ALTER TABLE user_card_states
      ADD COLUMN IF NOT EXISTS progress_state TEXT CHECK (progress_state IN ('new', 'learning', 'review'));
  `);
  await pool.query(`
    ALTER TABLE user_card_states
      ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE;
  `);
  await pool.query(`
    UPDATE user_card_states
    SET
      knowledge_state = CASE WHEN status = 'known' THEN 'known' ELSE 'unknown' END,
      progress_state = CASE WHEN status = 'known' THEN 'review' ELSE 'learning' END
    WHERE knowledge_state IS NULL OR progress_state IS NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_user_id ON user_card_states(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_status ON user_card_states(status);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_progress_state ON user_card_states(progress_state);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_due_at ON user_card_states(due_at);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_cards_domain ON knowledge_cards(domain);
  `);

  // Skip heavy card content UPSERT when content version is unchanged.
  // Schema migrations above must always run first.
  const versionRes = await pool.query(
    "SELECT value FROM schema_meta WHERE key = 'card_content_version'"
  );
  const storedVersion = versionRes.rows[0]?.value as string | undefined;
  const cardCountRes = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM knowledge_cards;'
  );
  const cardCount = parseInt(cardCountRes.rows[0]?.count ?? '0', 10);
  if (storedVersion === CARD_CONTENT_VERSION && cardCount > 0) {
    cardSchemaReady = true;
    cardSchemaPromise = null;
    return;
  }

  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const card of MOCK_CARDS) {
    const base = params.length;
    tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
    params.push(
      card.id,
      card.title,
      card.summary,
      card.explanation,
      card.wiki_url,
      card.domain,
      card.level
    );
  }

  if (tuples.length > 0) {
    await pool.query(
      `
      INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level)
      VALUES ${tuples.join(',\n')}
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        explanation = EXCLUDED.explanation,
        wiki_url = EXCLUDED.wiki_url,
        domain = EXCLUDED.domain,
        level = EXCLUDED.level;
      `,
      params
    );
  }

  // Persist the new content version so the next cold start skips re-seeding
  await pool.query(
    `INSERT INTO schema_meta (key, value) VALUES ('card_content_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CARD_CONTENT_VERSION]
  );

  cardSchemaReady = true;
  cardSchemaPromise = null;
}

function normalizeGraphNodeId(nodeId: string): string {
  if (nodeId.startsWith('graph_')) {
    return nodeId.slice('graph_'.length);
  }
  return nodeId;
}

function mapCardStatusToKnowledge(status: CardStatus): { knowledge: 0 | 0.5 | 1; confidence: number } {
  if (status === 'known') return { knowledge: 1, confidence: 0.8 };
  return { knowledge: 0.5, confidence: 0.45 }; // saved
}

function deriveLegacyStatus(row: {
  status?: CardStatus | null;
  knowledge_state?: CardKnowledgeState | null;
  progress_state?: CardProgressState | null;
}): CardStatus | null {
  if (row.knowledge_state === 'known') return 'known';
  if (row.progress_state === 'learning') return 'saved';
  return row.status ?? null;
}

function pickDistinctLabels(
  pool: string[],
  used: Set<string>,
  count: number,
  fallbackPrefix: string
): string[] {
  const picked: string[] = [];
  for (const label of pool) {
    if (!label || used.has(label)) continue;
    picked.push(label);
    used.add(label);
    if (picked.length >= count) break;
  }

  let fallbackIndex = 1;
  while (picked.length < count) {
    const fallback = `${fallbackPrefix} ${fallbackIndex}`;
    if (!used.has(fallback)) {
      picked.push(fallback);
      used.add(fallback);
    }
    fallbackIndex += 1;
  }

  return picked;
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRecallCue(card: KnowledgeCard | undefined, fallbackTitle: string): string {
  if (card?.summary?.trim()) {
    return card.summary.trim();
  }

  if (card?.explanation?.trim()) {
    const firstLine = card.explanation
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (firstLine) {
      return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
    }
  }

  return `Core idea of ${fallbackTitle}`;
}

export async function generateQuizForNode(nodeId: string): Promise<NodeQuiz> {
  await requireCurrentUser();

  const normalizedNodeId = normalizeGraphNodeId(nodeId);
  const node = NODE_BY_ID.get(normalizedNodeId);
  const card = CARDS_BY_ID.get(nodeId) ?? CARDS_BY_ID.get(`graph_${normalizedNodeId}`);

  const title = node?.label ?? card?.title ?? nodeId.replace(/^graph_/, '').replace(/_/g, ' ');
  const domain = card?.domain ?? mapGraphDomainToCardDomain(node?.domain ?? 'other');
  const cue = getRecallCue(card, title);
  const sameDomainLabels = MOCK_CARDS
    .filter((candidate) => candidate.id !== (card?.id ?? nodeId) && candidate.domain === domain)
    .map((candidate) => candidate.title);
  const crossDomainLabels = MOCK_CARDS
    .filter((candidate) => candidate.id !== (card?.id ?? nodeId) && candidate.domain !== domain)
    .map((candidate) => candidate.title);

  const used = new Set<string>();
  const correctChoice = title;
  used.add(correctChoice);
  const question = `Memorization check: Which concept matches this cue?\n"${cue}"`;
  const distractorPool = shuffle([...sameDomainLabels, ...crossDomainLabels]).filter(
    (label) => label !== correctChoice
  );
  const distractors = pickDistinctLabels(distractorPool, used, 3, 'Other concept');

  const choices = shuffle([correctChoice, ...distractors]) as QuizChoiceSet;
  const correctAnswerIndex = choices.findIndex((choice) => choice === correctChoice) as 0 | 1 | 2 | 3;

  return {
    nodeId: normalizedNodeId,
    question,
    choices,
    correctAnswerIndex,
  };
}

export async function getNextCard(mode: 'new' | 'review' = 'new', excludeIds?: string[]) {
  const user = await requireCurrentUser();
  const excluded = new Set(excludeIds ?? []);

  if (!process.env.DATABASE_URL) {
    const mockRows: CardWithStatusRow[] = MOCK_CARDS
      .filter((card) => !excluded.has(card.id))
      .map((card) => ({
        ...card,
        status: null,
        last_seen: null,
      }));

    const selected = selectSmartSuggestedCard(mockRows, mode);
    return selected ?? null;
  }

  try {
    await ensureCardSchema();

    let query = '';
    if (mode === 'review') {
      query = `
        SELECT kc.*
             , ucs.status
             , ucs.knowledge_state
             , ucs.progress_state
             , ucs.due_at
             , ucs.last_seen
        FROM knowledge_cards kc
        JOIN user_card_states ucs
          ON kc.id = ucs.card_id AND ucs.user_id = $1
        WHERE (ucs.progress_state = 'learning' OR (ucs.progress_state IS NULL AND ucs.status = 'saved'))
          AND (ucs.due_at IS NULL OR ucs.due_at <= NOW())
      `;
    } else {
      query = `
        SELECT kc.*
             , ucs.status
             , ucs.knowledge_state
             , ucs.progress_state
             , ucs.due_at
             , ucs.last_seen
        FROM knowledge_cards kc
        LEFT JOIN user_card_states ucs
          ON kc.id = ucs.card_id AND ucs.user_id = $1
      `;
    }

    const res = await pool.query(query, [user.id]);
    const rowsWithRelated = (res.rows as CardWithStatusRow[])
      .map((row) => ({
        ...row,
        status: deriveLegacyStatus(row),
      }))
      .map((row) => withRelatedConcepts(row));

    if (rowsWithRelated.length > 0) {
      const rows = excluded.size > 0
        ? rowsWithRelated.filter((r) => !excluded.has(r.id))
        : rowsWithRelated;
      const selected = selectSmartSuggestedCard(rows, mode);
      if (selected) return selected;
    }

    if (mode === 'review') return null;

    const fallbackRes = await pool.query('SELECT * FROM knowledge_cards ORDER BY RANDOM() LIMIT 1;');
    const fallbackCard = fallbackRes.rows[0] as KnowledgeCard | undefined;
    return fallbackCard ? withRelatedConcepts(fallbackCard) : null;
  } catch (error) {
    console.error('Error in getNextCard:', error);
    const mockRows: CardWithStatusRow[] = MOCK_CARDS
      .filter((card) => !excluded.has(card.id))
      .map((card) => ({
        ...card,
        status: null,
        last_seen: null,
      }));
    return selectSmartSuggestedCard(mockRows, mode);
  }
}

function selectSmartSuggestedCard(cards: CardWithStatusRow[], mode: 'new' | 'review'): KnowledgeCard | null {
  if (cards.length === 0) return null;

  const nodeStatusById = new Map<string, CardStatus | null>();
  for (const card of cards) {
    const nodeId = normalizeGraphNodeId(card.id);
    nodeStatusById.set(nodeId, card.status ?? null);
  }

  const candidates = cards.map((card) => {
    const nodeId = normalizeGraphNodeId(card.id);
    const cardStatus = card.status ?? null;
    const levelMeta = getCardLevelMeta(card.level);
    const memorizePriorityBonus = Math.max(0, 5 - levelMeta.rank) * 18;

    let score = 0;
    if (cardStatus === 'saved') score += 45;
    else if (cardStatus === null) score += 35;
    else score -= 100; // known

    const dependentNodeIds = PREREQ_OUTGOING.get(nodeId) ?? [];
    const blockedDependents = dependentNodeIds.filter((dependentId) => {
      const dependentStatus = nodeStatusById.get(dependentId) ?? null;
      return dependentStatus !== 'known';
    }).length;

    if (cardStatus !== 'known') {
      // Memorize-first: low-rank cards are intentionally prioritized.
      score += memorizePriorityBonus;
      score += blockedDependents * 6;
      score += dependentNodeIds.length * 2;
    }

    const lastSeenTs = card.last_seen ? new Date(card.last_seen).getTime() : 0;

    let suggest_reason = '';
    if (cardStatus === 'saved') {
      suggest_reason = `Memorize-first review · Difficulty ${levelMeta.rank} (${levelMeta.label})`;
    } else if (cardStatus !== 'known') {
      suggest_reason = `Memorize-first queue · Difficulty ${levelMeta.rank} (${levelMeta.label})`;
    }

    return {
      card: { ...card, suggest_reason },
      score,
      lastSeenTs,
      randomTieBreaker: Math.random(),
    };
  }).filter((candidate) => {
    if (mode === 'new') return candidate.card.status !== 'known';
    return candidate.card.status === 'saved';
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lastSeenTs !== b.lastSeenTs) return a.lastSeenTs - b.lastSeenTs;
    return a.randomTieBreaker - b.randomTieBreaker;
  });

  return candidates[0]?.card ?? null;
}

export async function saveCardState(cardId: string, status: CardStatus) {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return { success: true, warning: 'Mock mode: State not saved to DB' };
  }

  try {
    await ensureCardSchema();

    const mappedKnowledgeState: CardKnowledgeState = status === 'known' ? 'known' : 'unknown';
    const mappedProgressState: CardProgressState = status === 'known' ? 'review' : 'learning';
    const dueAt = status === 'known'
      ? "NOW() + INTERVAL '14 days'"
      : 'NOW()';

    const query = `
      INSERT INTO user_card_states (user_id, card_id, status, knowledge_state, progress_state, due_at, last_seen)
      VALUES ($1, $2, $3, $4, $5, ${dueAt}, NOW())
      ON CONFLICT (user_id, card_id)
      DO UPDATE SET
        status = $3,
        knowledge_state = $4,
        progress_state = $5,
        due_at = ${dueAt},
        last_seen = NOW();
    `;
    await pool.query(query, [user.id, cardId, status, mappedKnowledgeState, mappedProgressState]);

    // Sync knowledge graph — secondary operation, failure must not block card save
    try {
      const nodeId = normalizeGraphNodeId(cardId);
      const mapped = mapCardStatusToKnowledge(status);
      await pool.query(
        `
        INSERT INTO user_knowledge_states (user_id, node_id, knowledge_state, confidence, last_updated, first_known_at)
        SELECT $1, $2, $3, $4, NOW(), CASE WHEN $3 = 1 THEN NOW() ELSE NULL END
        WHERE EXISTS (SELECT 1 FROM graph_nodes WHERE id = $2)
        ON CONFLICT (user_id, node_id)
        DO UPDATE SET
          knowledge_state = EXCLUDED.knowledge_state,
          confidence = EXCLUDED.confidence,
          last_updated = NOW(),
          first_known_at = CASE
            WHEN EXCLUDED.knowledge_state = 1
              THEN COALESCE(user_knowledge_states.first_known_at, NOW())
            ELSE user_knowledge_states.first_known_at
          END;
        `,
        [user.id, nodeId, mapped.knowledge, mapped.confidence]
      );
    } catch (knowledgeErr) {
      // Non-critical: log but don't fail the whole save
      console.warn('Knowledge graph sync skipped:', knowledgeErr);
    }

    revalidatePath('/practice');
    revalidatePath('/saved');
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    revalidatePath('/ranking');

    return { success: true };
  } catch (error) {
    console.error('Error in saveCardState:', error);
    return { success: false };
  }
}

export async function getSavedCards() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return MOCK_CARDS.map((c) => ({ ...c, status: 'saved', last_seen: new Date() }));
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT kc.*, ucs.status, ucs.last_seen
      FROM knowledge_cards kc
      JOIN user_card_states ucs ON kc.id = ucs.card_id
      WHERE ucs.user_id = $1
        AND (ucs.progress_state = 'learning' OR (ucs.progress_state IS NULL AND ucs.status = 'saved'))
      ORDER BY ucs.last_seen DESC;
    `;
    const res = await pool.query(query, [user.id]);
    return (res.rows as CardWithStatusRow[]).map((row) => ({
      ...row,
      status: deriveLegacyStatus(row) ?? 'saved',
    }));
  } catch (error) {
    console.error('Error in getSavedCards:', error);
    return [];
  }
}

export async function removeSavedCard(cardId: string) {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return { success: true, warning: 'Mock mode: not persisted' };
  }

  try {
    await ensureCardSchema();

    await pool.query(
      `
      DELETE FROM user_card_states
      WHERE user_id = $1 AND card_id = $2;
      `,
      [user.id, cardId]
    );

    await pool.query(
      `
      DELETE FROM user_knowledge_states
      WHERE user_id = $1 AND node_id = $2;
      `,
      [user.id, normalizeGraphNodeId(cardId)]
    );

    revalidatePath('/saved');
    revalidatePath('/practice');
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    revalidatePath('/');
    revalidatePath('/ranking');

    return { success: true };
  } catch (error) {
    console.error('Error in removeSavedCard:', error);
    return { success: false };
  }
}

export async function getUserStats() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return { known: 12, saved: 5 };
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT
        COUNT(*) FILTER (
          WHERE knowledge_state = 'known'
            OR (knowledge_state IS NULL AND status = 'known')
        ) AS known_count,
        COUNT(*) FILTER (
          WHERE progress_state = 'learning'
            OR (progress_state IS NULL AND status = 'saved')
        ) AS saved_count
      FROM user_card_states
      WHERE user_id = $1;
    `;
    const res = await pool.query<{ known_count: string; saved_count: string }>(query, [user.id]);

    const row = res.rows[0];
    return {
      known: parseInt(row?.known_count ?? '0', 10),
      saved: parseInt(row?.saved_count ?? '0', 10),
    };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { known: 0, saved: 0 };
  }
}

export async function getAllCardsWithStatus() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return MOCK_CARDS.map((c) => ({
      ...c,
      status: ['known', 'saved', null][
        Math.floor(Math.random() * 3)
      ] as CardStatus | null,
    }));
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT kc.*, ucs.status, ucs.knowledge_state, ucs.progress_state
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs
        ON kc.id = ucs.card_id AND ucs.user_id = $1
      ORDER BY
        kc.domain,
        CASE kc.level
          WHEN 'memorize' THEN 1
          WHEN 'understand' THEN 2
          WHEN 'connect' THEN 3
          WHEN 'apply' THEN 4
          ELSE 99
        END,
        kc.title;
    `;

    const res = await pool.query(query, [user.id]);
    return (res.rows as CardWithStatusRow[])
      .map((row) => ({ ...row, status: deriveLegacyStatus(row) }))
      .map((row) => withRelatedConcepts(row));
  } catch (error) {
    console.error('Error in getAllCardsWithStatus:', error);
    return MOCK_CARDS.map((c) => ({
      ...c,
      status: null as CardStatus | null,
    }));
  }
}

export async function resetUserCardProgress() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return { success: true, warning: 'Mock mode: not persisted' };
  }

  try {
    await pool.query('DELETE FROM user_card_states WHERE user_id = $1;', [user.id]);
    await pool.query('DELETE FROM user_knowledge_states WHERE user_id = $1;', [user.id]);

    revalidatePath('/');
    revalidatePath('/practice');
    revalidatePath('/saved');
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    revalidatePath('/ranking');

    return { success: true };
  } catch (error) {
    console.error('Error in resetUserCardProgress:', error);
    return { success: false };
  }
}

export type CardLeaderboardEntry = {
  userId: string;
  known: number;
  avgScore: number;
};

export type UserCardDomainProgress = {
  domain: string;
  reviewed: number;
  known: number;
  saved: number;
};

export async function getCardLeaderboard(): Promise<CardLeaderboardEntry[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT
        user_id,
        COUNT(*) FILTER (
          WHERE knowledge_state = 'known'
            OR (knowledge_state IS NULL AND status = 'known')
        ) AS known_count,
        COUNT(*) AS total_count
      FROM user_card_states
      GROUP BY user_id
      ORDER BY known_count DESC, total_count DESC, user_id ASC
      LIMIT 100;
    `;

    const res = await pool.query<LeaderboardRow>(query);
    return res.rows.map((row) => {
      const known = parseInt(row.known_count, 10);
      const total = parseInt(row.total_count, 10);
      return {
        userId: row.user_id,
        known,
        avgScore: total > 0 ? known / total : 0,
      };
    });
  } catch (error) {
    console.error('Error in getCardLeaderboard:', error);
    return [];
  }
}

export async function getUserCardDomainProgress(): Promise<UserCardDomainProgress[]> {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT
        COALESCE(kc.domain, 'other') AS domain,
        COUNT(*) AS reviewed,
        COUNT(*) FILTER (
          WHERE ucs.knowledge_state = 'known'
            OR (ucs.knowledge_state IS NULL AND ucs.status = 'known')
        ) AS known,
        COUNT(*) FILTER (
          WHERE ucs.progress_state = 'learning'
            OR (ucs.progress_state IS NULL AND ucs.status = 'saved')
        ) AS saved
      FROM user_card_states ucs
      JOIN knowledge_cards kc ON kc.id = ucs.card_id
      WHERE ucs.user_id = $1
      GROUP BY COALESCE(kc.domain, 'other')
      ORDER BY reviewed DESC, domain ASC;
    `;
    const res = await pool.query<{
      domain: string;
      reviewed: string;
      known: string;
      saved: string;
    }>(query, [user.id]);

    return res.rows.map((row) => ({
      domain: row.domain,
      reviewed: parseInt(row.reviewed, 10),
      known: parseInt(row.known, 10),
      saved: parseInt(row.saved, 10),
    }));
  } catch (error) {
    console.error('Error in getUserCardDomainProgress:', error);
    return [];
  }
}
