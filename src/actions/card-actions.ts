'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';
import { GRAPH_EDGES } from '@/data/graph-edges';
import { GRAPH_NODES } from '@/data/graph-nodes';

export type KnowledgeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  level: string;
  related_concepts?: string[];
  suggest_reason?: string;
};

export type CardStatus = 'known' | 'saved' | 'unknown';
export type QuizChoiceSet = [string, string, string, string];

export type NodeQuiz = {
  nodeId: string;
  question: string;
  choices: QuizChoiceSet;
  correctAnswerIndex: 0 | 1 | 2 | 3;
};

type CardWithStatusRow = KnowledgeCard & {
  status: CardStatus | null;
  last_seen?: Date | null;
};

type LeaderboardRow = {
  user_id: string;
  known_count: string;
  total_count: string;
};

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
  if (key.includes('control')) return 'control';
  if (key.includes('signal')) return 'signal';
  if (key.includes('machine') || key.includes('learning') || key.includes('intelligence')) return 'ml';
  if (key.includes('algorithm') || key.includes('computer') || key.includes('data')) return 'info';
  return 'other';
}

function mapDifficultyToLevel(difficulty: number): KnowledgeCard['level'] {
  if (difficulty <= 1) return 'memorize';
  if (difficulty <= 2) return 'understand';
  if (difficulty <= 3) return 'connect';
  return 'apply';
}

const GENERATED_MOCK_CARDS: KnowledgeCard[] = GRAPH_NODES
  .filter((node) => node.level > 0)
  .slice(0, 180)
  .map((node) => {
    const related = (EDGE_MAP[node.id] ?? [])
      .map((id) => GRAPH_NODES.find((candidate) => candidate.id === id)?.label)
      .filter((label): label is string => Boolean(label))
      .slice(0, 4);

    return {
      id: `graph_${node.id}`,
      title: node.label,
      summary: `${node.type} in ${node.domain}`,
      explanation: [
        `Type: ${node.type}`,
        `Domain: ${node.domain}`,
        `Difficulty: ${node.difficulty}/5`,
        `Use this card to connect the concept with at least one prerequisite and one downstream application.`,
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
  if (!process.env.DATABASE_URL || cardSchemaReady) return;
  if (cardSchemaPromise) return cardSchemaPromise;
  cardSchemaPromise = _initCardSchema();
  return cardSchemaPromise;
}

async function _initCardSchema() {

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
      status TEXT CHECK (status IN ('known', 'saved', 'unknown')),
      confidence INTEGER DEFAULT 0,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, card_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_user_id ON user_card_states(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_card_states_status ON user_card_states(status);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_cards_domain ON knowledge_cards(domain);
  `);

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

  cardSchemaReady = true;
}

function normalizeGraphNodeId(nodeId: string): string {
  if (nodeId.startsWith('graph_')) {
    return nodeId.slice('graph_'.length);
  }
  return nodeId;
}

function mapCardStatusToKnowledge(status: CardStatus): { knowledge: 0 | 0.5 | 1; confidence: number } {
  if (status === 'known') return { knowledge: 1, confidence: 0.8 };
  if (status === 'saved') return { knowledge: 0.5, confidence: 0.45 };
  return { knowledge: 0, confidence: 0.25 };
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

export async function generateQuizForNode(nodeId: string): Promise<NodeQuiz> {
  await requireCurrentUser();

  const normalizedNodeId = normalizeGraphNodeId(nodeId);
  const node = NODE_BY_ID.get(normalizedNodeId);
  const card = CARDS_BY_ID.get(nodeId) ?? CARDS_BY_ID.get(`graph_${normalizedNodeId}`);

  const title = node?.label ?? card?.title ?? nodeId.replace(/^graph_/, '').replace(/_/g, ' ');
  const domain = node?.domain ?? card?.domain ?? 'General STEM';

  const incomingPrereqs = (PREREQ_INCOMING.get(normalizedNodeId) ?? [])
    .map((id) => NODE_BY_ID.get(id)?.label)
    .filter((label): label is string => Boolean(label));
  const outgoingDependents = (PREREQ_OUTGOING.get(normalizedNodeId) ?? [])
    .map((id) => NODE_BY_ID.get(id)?.label)
    .filter((label): label is string => Boolean(label));
  const sameDomainLabels = GRAPH_NODES
    .filter((candidate) => candidate.domain === domain && candidate.id !== normalizedNodeId)
    .map((candidate) => candidate.label);

  const used = new Set<string>();
  let question = '';
  let correctChoice = '';
  let distractors: string[] = [];

  if (incomingPrereqs.length > 0) {
    correctChoice = incomingPrereqs[0];
    used.add(correctChoice);
    question = `Before mastering "${title}", which concept is the strongest prerequisite to review first?`;
    const distractorPool = shuffle(sameDomainLabels.filter((label) => !incomingPrereqs.includes(label)));
    distractors = pickDistinctLabels(distractorPool, used, 3, 'Unrelated prerequisite');
  } else if (outgoingDependents.length > 0) {
    correctChoice = outgoingDependents[0];
    used.add(correctChoice);
    question = `If you become confident in "${title}", which downstream topic is most directly unlocked next?`;
    const distractorPool = shuffle(sameDomainLabels.filter((label) => !outgoingDependents.includes(label)));
    distractors = pickDistinctLabels(distractorPool, used, 3, 'Indirect downstream topic');
  } else {
    correctChoice = domain;
    used.add(correctChoice);
    question = `What is the primary learning domain for "${title}"?`;
    const otherDomains = shuffle(UNIQUE_DOMAINS.filter((candidateDomain) => candidateDomain !== domain));
    distractors = pickDistinctLabels(otherDomains, used, 3, 'Other domain');
  }

  const choices = shuffle([correctChoice, ...distractors]) as QuizChoiceSet;
  const correctAnswerIndex = choices.findIndex((choice) => choice === correctChoice) as 0 | 1 | 2 | 3;

  return {
    nodeId: normalizedNodeId,
    question,
    choices,
    correctAnswerIndex,
  };
}

export async function getNextCard() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    const mockRows: CardWithStatusRow[] = MOCK_CARDS.map((card) => ({
      ...card,
      status: null,
      last_seen: null,
    }));

    const selected = selectSmartSuggestedCard(mockRows);
    return selected ?? MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT kc.*
           , ucs.status
           , ucs.last_seen
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs
        ON kc.id = ucs.card_id AND ucs.user_id = $1
    `;

    const res = await pool.query(query, [user.id]);
    if (res.rows.length > 0) {
      const selected = selectSmartSuggestedCard(res.rows as CardWithStatusRow[]);
      if (selected) return selected;
    }

    const fallbackRes = await pool.query('SELECT * FROM knowledge_cards ORDER BY RANDOM() LIMIT 1;');
    return (fallbackRes.rows[0] as KnowledgeCard) ?? null;
  } catch (error) {
    console.error('Error in getNextCard:', error);
    return null;
  }
}

function selectSmartSuggestedCard(cards: CardWithStatusRow[]): KnowledgeCard | null {
  if (cards.length === 0) return null;

  const nodeStatusById = new Map<string, CardStatus | null>();
  for (const card of cards) {
    const nodeId = normalizeGraphNodeId(card.id);
    nodeStatusById.set(nodeId, card.status ?? null);
  }

  const candidates = cards.map((card) => {
    const nodeId = normalizeGraphNodeId(card.id);
    const cardStatus = card.status ?? null;

    let score = 0;
    if (cardStatus === 'unknown') score += 70;
    else if (cardStatus === 'saved') score += 45;
    else if (cardStatus === null) score += 35;
    else score -= 100;

    const dependentNodeIds = PREREQ_OUTGOING.get(nodeId) ?? [];
    const blockedDependents = dependentNodeIds.filter((dependentId) => {
      const dependentStatus = nodeStatusById.get(dependentId) ?? null;
      return dependentStatus !== 'known';
    }).length;

    if (cardStatus !== 'known') {
      score += blockedDependents * 12;
      score += dependentNodeIds.length * 4;
    }

    if (cardStatus === 'unknown' && blockedDependents > 0) {
      score += 18;
    }

    const lastSeenTs = card.last_seen ? new Date(card.last_seen).getTime() : 0;

    let suggest_reason = '';
    if (blockedDependents > 0) {
      suggest_reason = `Blocks ${blockedDependents} downstream concept${blockedDependents === 1 ? '' : 's'}`;
    } else if (cardStatus === 'unknown') {
      suggest_reason = 'New topic in your current path';
    } else if (cardStatus === 'saved') {
      suggest_reason = 'Reviewing your saved bookmarks';
    }

    return {
      card: { ...card, suggest_reason },
      score,
      lastSeenTs,
      randomTieBreaker: Math.random(),
    };
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

    const query = `
      INSERT INTO user_card_states (user_id, card_id, status, last_seen)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, card_id)
      DO UPDATE SET status = $3, last_seen = NOW();
    `;
    await pool.query(query, [user.id, cardId, status]);

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
      WHERE ucs.user_id = $1 AND ucs.status = 'saved'
      ORDER BY ucs.last_seen DESC;
    `;
    const res = await pool.query(query, [user.id]);
    return res.rows;
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
    return { known: 12, saved: 5, unknown: 3 };
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT status, COUNT(*) as count
      FROM user_card_states
      WHERE user_id = $1
      GROUP BY status;
    `;
    const res = await pool.query<{ status: string; count: string }>(query, [user.id]);

    const stats = {
      known: 0,
      saved: 0,
      unknown: 0,
    };

    res.rows.forEach((row) => {
      if (row.status === 'known') stats.known = parseInt(row.count, 10);
      if (row.status === 'saved') stats.saved = parseInt(row.count, 10);
      if (row.status === 'unknown') stats.unknown = parseInt(row.count, 10);
    });

    return stats;
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { known: 0, saved: 0, unknown: 0 };
  }
}

export async function getAllCardsWithStatus() {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return MOCK_CARDS.map((c) => ({
      ...c,
      status: ['known', 'saved', 'unknown', null][
        Math.floor(Math.random() * 4)
      ] as CardStatus | null,
    }));
  }

  try {
    await ensureCardSchema();

    const query = `
      SELECT kc.*, ucs.status
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs
        ON kc.id = ucs.card_id AND ucs.user_id = $1
      ORDER BY kc.domain, kc.level;
    `;

    const res = await pool.query(query, [user.id]);
    return res.rows as (KnowledgeCard & { status: CardStatus | null })[];
  } catch (error) {
    console.error('Error in getAllCardsWithStatus:', error);
    return [];
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
  unknown: number;
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
        COUNT(*) FILTER (WHERE status = 'known') AS known_count,
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
        COUNT(*) FILTER (WHERE ucs.status = 'known') AS known,
        COUNT(*) FILTER (WHERE ucs.status = 'saved') AS saved,
        COUNT(*) FILTER (WHERE ucs.status = 'unknown') AS unknown
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
      unknown: string;
    }>(query, [user.id]);

    return res.rows.map((row) => ({
      domain: row.domain,
      reviewed: parseInt(row.reviewed, 10),
      known: parseInt(row.known, 10),
      saved: parseInt(row.saved, 10),
      unknown: parseInt(row.unknown, 10),
    }));
  } catch (error) {
    console.error('Error in getUserCardDomainProgress:', error);
    return [];
  }
}
