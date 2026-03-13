'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';
import { GRAPH_EDGES } from '@/data/graph-edges';
import { GRAPH_NODES } from '@/data/graph-nodes';
import { CARD_CONTENT } from '@/data/card-content';
import { getCardLevelMeta, type CardLevel } from '@/lib/card-level';

export type PrerequisiteInfo = {
  id: string;
  label: string;
  status: CardStatus | null;
};

export type KnowledgeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  level: CardLevel;
  related_concepts?: string[];
  prerequisites?: PrerequisiteInfo[];
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
const CARD_CONTENT_VERSION = '10';

let cardSchemaReady = false;
let cardSchemaPromise: Promise<void> | null = null;

const DEFAULT_CARD_POOL_SIZE = 1000;
const MAX_CARD_POOL_SIZE = 20000;
function getCardPoolSize(): number {
  const raw = process.env.CARD_POOL_SIZE;
  if (!raw) return DEFAULT_CARD_POOL_SIZE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CARD_POOL_SIZE;
  return Math.min(parsed, MAX_CARD_POOL_SIZE);
}

const TARGET_CARD_COUNT = getCardPoolSize();

const DEFAULT_KNOWLEDGE_CARD_LIMIT = 600;
const MAX_KNOWLEDGE_CARD_LIMIT = 5000;
function getKnowledgeCardLimit(): number {
  const raw = process.env.KNOWLEDGE_CARD_LIMIT;
  if (!raw) return DEFAULT_KNOWLEDGE_CARD_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_KNOWLEDGE_CARD_LIMIT;
  return Math.min(parsed, MAX_KNOWLEDGE_CARD_LIMIT);
}

const KNOWLEDGE_CARD_LIMIT = getKnowledgeCardLimit();

const DRILL_GENERATION_BATCH = 250;
const ALLOW_DRILL_CARDS = false;

const EDGE_MAP = GRAPH_EDGES.reduce<Record<string, string[]>>((acc, edge) => {
  if (!acc[edge.source]) acc[edge.source] = [];
  if (!acc[edge.target]) acc[edge.target] = [];
  acc[edge.source].push(edge.target);
  acc[edge.target].push(edge.source);
  return acc;
}, {});

const NODE_LABEL_BY_ID = new Map<string, string>(GRAPH_NODES.map((node) => [node.id, node.label]));

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
  if (
    key.includes('algorithm') ||
    key.includes('compiler') ||
    key.includes('database') ||
    key.includes('computer') ||
    key.includes('data') ||
    key.includes('architecture') ||
    key === 'os' ||
    key.includes('operating') ||
    key.includes('security') ||
    key.includes('cloud') ||
    key.includes('devops') ||
    key.includes('network') ||
    key.includes('software') ||
    key.includes('programming') ||
    key.includes('distributed') ||
    key.includes('theoretical') ||
    key.includes('system')
  )
    return 'info';
  return 'other';
}

function mapDifficultyToLevel(difficulty: number): CardLevel {
  if (difficulty <= 1) return 'memorize';
  if (difficulty <= 2) return 'understand';
  if (difficulty <= 3) return 'connect';
  return 'apply';
}

function pickFirstNonEmptyLine(text: string | undefined, maxLen: number) {
  if (!text) return null;
  const first = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return null;
  return first.length > maxLen ? `${first.slice(0, Math.max(0, maxLen - 3))}...` : first;
}

function normalizeDrillCardId(cardId: string): string {
  // drill_<nodeId>__<variant>
  if (!cardId.startsWith('drill_')) return cardId;
  const withoutPrefix = cardId.slice('drill_'.length);
  const [nodeId] = withoutPrefix.split('__');
  return nodeId || cardId;
}

const META_NODE_IDS = new Set(['mathematics', 'computer_science', 'machine_learning', 'artificial_intelligence']);

function hasSubstantiveContent(content: { summary: string; explanation: string } | undefined | null) {
  if (!content) return false;
  const summary = content.summary?.trim() ?? '';
  const explanation = content.explanation?.trim() ?? '';
  return summary.length >= 20 && explanation.length >= 80;
}

const CORE_GRAPH_CARDS: KnowledgeCard[] = GRAPH_NODES
  .filter((node) => node.level > 0 && !META_NODE_IDS.has(node.id))
  .slice(0, KNOWLEDGE_CARD_LIMIT)
  .map<KnowledgeCard | null>((node) => {
    const content = CARD_CONTENT[node.id];
    if (!hasSubstantiveContent(content)) return null;
    const related = (EDGE_MAP[node.id] ?? [])
      .map((id) => NODE_LABEL_BY_ID.get(id))
      .filter((label): label is string => Boolean(label))
      .slice(0, 4);
    const relatedPayload = related.length > 0 ? { related_concepts: related } : {};
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
      ...relatedPayload,
    };
  })
  .filter((card): card is KnowledgeCard => Boolean(card));

const CORE_CARDS: KnowledgeCard[] = CORE_GRAPH_CARDS;

const DRILL_ELIGIBLE_NODES = [...GRAPH_NODES]
  .filter((node) => node.level > 0)
  .sort((a, b) => {
    if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
    return a.label.localeCompare(b.label);
  });

function generateDrillCard(node: (typeof GRAPH_NODES)[number], variantIndex: number): KnowledgeCard {
  const content = CARD_CONTENT[node.id];
  const related = (EDGE_MAP[node.id] ?? [])
    .map((id) => NODE_LABEL_BY_ID.get(id))
    .filter((label): label is string => Boolean(label))
    .slice(0, 4);

  const templates = [
    {
      titleSuffix: 'Self-Test',
      prompts: [
        '1) Define it in one sentence.',
        '2) Give a minimal example or use-case.',
        '3) State one assumption, limitation, or failure mode.',
      ],
    },
    {
      titleSuffix: 'Compare',
      prompts: [
        '1) Compare it to a similar concept.',
        '2) State the key difference in one line.',
        '3) Give a scenario where the other one is better.',
      ],
    },
    {
      titleSuffix: 'Mistakes',
      prompts: [
        '1) List one common misconception.',
        '2) Explain why it is wrong.',
        '3) Give a counterexample.',
      ],
    },
    {
      titleSuffix: 'Derivation',
      prompts: [
        '1) Write the core formula or rule (if any).',
        '2) Explain the intuition behind it.',
        '3) State a condition where it breaks.',
      ],
    },
  ] as const;

  const template = templates[variantIndex % templates.length];
  const hintSummary = content?.summary ? `Hint: ${content.summary}` : null;
  const hintDetail = pickFirstNonEmptyLine(content?.explanation, 180);
  const connectLine = related.length > 0 ? `Connect: ${related.join(' · ')}` : null;

  const explanationParts = [
    hintSummary,
    hintDetail ? `Hint detail: ${hintDetail}` : null,
    'Self-test:',
    ...template.prompts,
    connectLine,
  ].filter((part): part is string => Boolean(part));

  return {
    id: `drill_${node.id}__${variantIndex}`,
    title: `${node.label} (${template.titleSuffix} #${variantIndex + 1})`,
    summary: `Practice prompts to strengthen recall for ${node.label}.`,
    explanation: explanationParts.join('\n'),
    wiki_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(node.label.replace(/\s+/g, '_'))}`,
    domain: mapGraphDomainToCardDomain(node.domain),
    level: mapDifficultyToLevel(node.difficulty),
  };
}

function generateDrillCards(count: number, startIndex: number): KnowledgeCard[] {
  if (count <= 0) return [];
  if (DRILL_ELIGIBLE_NODES.length === 0) return [];

  const cards: KnowledgeCard[] = [];
  for (let i = 0; i < count; i += 1) {
    const globalIndex = startIndex + i;
    const node = DRILL_ELIGIBLE_NODES[globalIndex % DRILL_ELIGIBLE_NODES.length];
    const variantIndex = Math.floor(globalIndex / DRILL_ELIGIBLE_NODES.length);
    cards.push(generateDrillCard(node, variantIndex));
  }
  return cards;
}

const MOCK_CARDS: KnowledgeCard[] = [...CORE_CARDS].slice(0, TARGET_CARD_COUNT);

const NODE_BY_ID = new Map(GRAPH_NODES.map((node) => [node.id, node]));
const CARDS_BY_ID = new Map(MOCK_CARDS.map((card) => [card.id, card]));
const PREREQ_INCOMING = new Map<string, string[]>();
const PREREQ_OUTGOING = new Map<string, string[]>();

function isExcludedFromKnowledgeMap(cardId: string) {
  // Drill cards are used for practice volume, but are intentionally hidden from the graph/map UI.
  return cardId.startsWith('drill_');
}

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

  // Drill cards are generated over time; store a marker so we can cheaply count them.
  await pool.query(`
    ALTER TABLE knowledge_cards
      ADD COLUMN IF NOT EXISTS is_generated BOOLEAN NOT NULL DEFAULT FALSE;
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
  const expectedCardCount = MOCK_CARDS.length;
  if (storedVersion === CARD_CONTENT_VERSION && cardCount >= expectedCardCount) {
    cardSchemaReady = true;
    cardSchemaPromise = null;
    return;
  }

  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const card of MOCK_CARDS) {
    const base = params.length;
    tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
    params.push(
      card.id,
      card.title,
      card.summary,
      card.explanation,
      card.wiki_url,
      card.domain,
      card.level,
      card.id.startsWith('drill_')
    );
  }

  if (tuples.length > 0) {
    await pool.query(
      `
      INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level, is_generated)
      VALUES ${tuples.join(',\n')}
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        explanation = EXCLUDED.explanation,
        wiki_url = EXCLUDED.wiki_url,
        domain = EXCLUDED.domain,
        level = EXCLUDED.level,
        is_generated = EXCLUDED.is_generated;
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

async function ensureMoreGeneratedCards(minAdd: number) {
  if (!process.env.DATABASE_URL) return;
  if (!ALLOW_DRILL_CARDS) return;
  if (minAdd <= 0) return;

  // Count existing generated drill cards; use both marker and id prefix for backward compatibility.
  const existingRes = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM knowledge_cards WHERE is_generated = TRUE OR id LIKE 'drill_%';"
  );
  const existing = parseInt(existingRes.rows[0]?.count ?? '0', 10);

  const toAdd = Math.max(minAdd, DRILL_GENERATION_BATCH);
  const newCards = generateDrillCards(toAdd, existing);
  if (newCards.length === 0) return;

  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const card of newCards) {
    const base = params.length;
    tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
    params.push(
      card.id,
      card.title,
      card.summary,
      card.explanation,
      card.wiki_url,
      card.domain,
      card.level,
      true
    );
  }

  await pool.query(
    `
    INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level, is_generated)
    VALUES ${tuples.join(',\n')}
    ON CONFLICT (id) DO NOTHING;
    `,
    params
  );
}

function normalizeGraphNodeId(nodeId: string): string {
  if (nodeId.startsWith('drill_')) {
    return normalizeDrillCardId(nodeId);
  }
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
  let card = CARDS_BY_ID.get(nodeId) ?? CARDS_BY_ID.get(`graph_${normalizedNodeId}`);
  if (!card && process.env.DATABASE_URL) {
    try {
      await ensureCardSchema();
      const res = await pool.query('SELECT * FROM knowledge_cards WHERE id = $1 LIMIT 1;', [nodeId]);
      card = res.rows[0] as KnowledgeCard | undefined;
    } catch {
      // ignore; quiz will fall back to generic cue
    }
  }

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

    // If the user has exhausted all "new" candidates, generate more drill cards on demand.
    await ensureMoreGeneratedCards(1);

    const retryRes = await pool.query(query, [user.id]);
    const retryRowsWithRelated = (retryRes.rows as CardWithStatusRow[])
      .map((row) => ({
        ...row,
        status: deriveLegacyStatus(row),
      }))
      .map((row) => withRelatedConcepts(row));

    if (retryRowsWithRelated.length > 0) {
      const rows = excluded.size > 0
        ? retryRowsWithRelated.filter((r) => !excluded.has(r.id))
        : retryRowsWithRelated;
      const selected = selectSmartSuggestedCard(rows, mode);
      if (selected) return selected;
    }

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

    return {
      card,
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

  const selected = candidates[0]?.card;
  if (!selected) return null;

  const normalizedId = normalizeGraphNodeId(selected.id);
  const prereqNodeIds = (PREREQ_INCOMING.get(normalizedId) ?? []).slice(0, 3);
  const prerequisites: PrerequisiteInfo[] = prereqNodeIds.map((prereqId) => {
    const label = NODE_BY_ID.get(prereqId)?.label ?? prereqId.replace(/_/g, ' ');
    const status = nodeStatusById.get(prereqId) ?? null;
    return { id: prereqId, label, status };
  });

  return { ...selected, prerequisites: prerequisites.length > 0 ? prerequisites : undefined };
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

    // Do NOT revalidate '/practice' — the practice session is fully client-managed.
    // Revalidating triggers a server re-render that overwrites CardViewer state mid-session.
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

export async function getAllCardsWithStatus(options?: {
  includeGenerated?: boolean;
  generatedLimit?: number;
}) {
  const user = await requireCurrentUser();
  const includeGenerated = options?.includeGenerated ?? false;
  const generatedLimit = Math.max(0, Math.min(options?.generatedLimit ?? DRILL_GENERATION_BATCH, 5000));

  if (!process.env.DATABASE_URL) {
    const cards = includeGenerated
      ? MOCK_CARDS
      : MOCK_CARDS.filter((c) => !isExcludedFromKnowledgeMap(c.id));

    const limited = includeGenerated
      ? [
          ...cards.filter((c) => !c.id.startsWith('drill_')),
          ...cards.filter((c) => c.id.startsWith('drill_')).slice(0, generatedLimit),
        ]
      : cards;

    return limited.map((c) => ({
      ...c,
      status: ['known', 'saved', null][
        Math.floor(Math.random() * 3)
      ] as CardStatus | null,
    }));
  }

  try {
    await ensureCardSchema();

    if (!includeGenerated) {
      const query = `
        SELECT kc.*, ucs.status, ucs.knowledge_state, ucs.progress_state
        FROM knowledge_cards kc
        LEFT JOIN user_card_states ucs
          ON kc.id = ucs.card_id AND ucs.user_id = $1
        WHERE kc.id NOT LIKE 'drill_%'
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
    }

    // Ensure we can satisfy the requested generatedLimit.
    const generatedCountRes = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM knowledge_cards WHERE is_generated = TRUE OR id LIKE 'drill_%';"
    );
    const existingGenerated = parseInt(generatedCountRes.rows[0]?.count ?? '0', 10);
    if (existingGenerated < generatedLimit) {
      await ensureMoreGeneratedCards(generatedLimit - existingGenerated);
    }

    const coreQuery = `
      SELECT kc.*, ucs.status, ucs.knowledge_state, ucs.progress_state
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs
        ON kc.id = ucs.card_id AND ucs.user_id = $1
      WHERE kc.id NOT LIKE 'drill_%'
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

    const generatedQuery = `
      SELECT kc.*, ucs.status, ucs.knowledge_state, ucs.progress_state
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs
        ON kc.id = ucs.card_id AND ucs.user_id = $1
      WHERE (kc.is_generated = TRUE OR kc.id LIKE 'drill_%')
      ORDER BY kc.created_at DESC, kc.id DESC
      LIMIT $2;
    `;

    const [coreRes, generatedRes] = await Promise.all([
      pool.query(coreQuery, [user.id]),
      pool.query(generatedQuery, [user.id, generatedLimit]),
    ]);

    const merged = [...coreRes.rows, ...generatedRes.rows] as CardWithStatusRow[];
    return merged
      .map((row) => ({ ...row, status: deriveLegacyStatus(row) }))
      .map((row) => withRelatedConcepts(row));
  } catch (error) {
    console.error('Error in getAllCardsWithStatus:', error);
    const cards = includeGenerated
      ? MOCK_CARDS
      : MOCK_CARDS.filter((c) => !isExcludedFromKnowledgeMap(c.id));
    const limited = includeGenerated
      ? [
          ...cards.filter((c) => !c.id.startsWith('drill_')),
          ...cards.filter((c) => c.id.startsWith('drill_')).slice(0, generatedLimit),
        ]
      : cards;
    return limited.map((c) => ({
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
