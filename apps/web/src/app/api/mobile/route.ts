import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCardsWithStatus,
  getCardLeaderboard,
  getNextCard,
  getSavedCards,
  getUserCardDomainProgress,
  getUserStats,
  removeSavedCard,
  resetUserCardProgress,
  saveCardState,
  type CardStatus,
} from '@/actions/card-actions';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getDeletedKnowledgeItems,
  getUserKnowledgeItems,
  restoreKnowledgeItem,
  updateKnowledgeItem,
} from '@/actions/user-knowledge-actions';
import {
  createAdminEdge,
  createAdminNode,
  deleteAdminEdge,
  deleteAdminNode,
  getAdminEdges,
  getAdminNodes,
  getAdminUsers,
} from '@/actions/admin-actions';
import { getCurrentUser } from '@/lib/auth';

const MAX_JSON_BYTES = 16_384;

async function requireMobileUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

async function isMobileAdmin() {
  const user = await getCurrentUser();
  return Boolean(user && process.env.ADMIN_CLERK_USER_ID && user.id === process.env.ADMIN_CLERK_USER_ID);
}

function unauthorized() {
  return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
}

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function stringField(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) return null;
  try {
    const value: unknown = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function toFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

export async function GET(request: NextRequest) {
  if (!await requireMobileUser()) return unauthorized();

  const resource = request.nextUrl.searchParams.get('resource');
  switch (resource) {
    case 'admin-nodes':
      if (!await isMobileAdmin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
      return NextResponse.json({ nodes: await getAdminNodes() });
    case 'admin-edges':
      if (!await isMobileAdmin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
      return NextResponse.json({ edges: await getAdminEdges(), nodes: await getAdminNodes() });
    case 'admin-users':
      if (!await isMobileAdmin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
      return NextResponse.json({ users: await getAdminUsers() });
    case 'notes': {
      const view = request.nextUrl.searchParams.get('view');
      const items = view === 'trash' ? await getDeletedKnowledgeItems() : await getUserKnowledgeItems();
      return NextResponse.json({ items });
    }
    case 'graph': {
      const [cards, personalItems] = await Promise.all([getAllCardsWithStatus(), getUserKnowledgeItems()]);
      return NextResponse.json({ cards, personalItems });
    }
    case 'practice': {
      const mode = request.nextUrl.searchParams.get('mode') === 'review' ? 'review' : 'new';
      const exclude = request.nextUrl.searchParams.getAll('exclude').filter((id) => id.length <= 160).slice(0, 100);
      const [card, stats] = await Promise.all([getNextCard(mode, exclude), getUserStats()]);
      return NextResponse.json({ card, stats });
    }
    case 'saved':
      return NextResponse.json({ cards: await getSavedCards() });
    case 'dashboard': {
      const [stats, domains] = await Promise.all([getUserStats(), getUserCardDomainProgress()]);
      return NextResponse.json({ stats, domains });
    }
    case 'ranking':
      return NextResponse.json({ rows: await getCardLeaderboard() });
    default:
      return invalid('Unknown mobile resource.');
  }
}

export async function POST(request: NextRequest) {
  if (!await requireMobileUser()) return unauthorized();
  const body = await readBody(request);
  if (!body) return invalid('A small JSON object is required.');

  const action = stringField(body.action, 64);
  if (!action) return invalid('An action is required.');

  if (action.startsWith('admin-')) {
    if (!await isMobileAdmin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    if (action === 'admin-delete-node') {
      const id = stringField(body.id, 100); if (!id) return invalid('A node id is required.');
      await deleteAdminNode(id); return NextResponse.json({ success: true });
    }
    if (action === 'admin-delete-edge') {
      const id = body.id; if (!Number.isInteger(id) || (id as number) < 1) return invalid('A valid edge id is required.');
      await deleteAdminEdge(id as number); return NextResponse.json({ success: true });
    }
    if (action === 'admin-create-node') {
      const id = stringField(body.id, 100); const label = stringField(body.label, 200); const domain = stringField(body.domain, 50); const type = stringField(body.type, 50);
      if (!id || !label || !domain || !type || typeof body.level !== 'number' || typeof body.difficulty !== 'number') return invalid('Complete node fields are required.');
      await createAdminNode({ id, label, domain, type, level: body.level, difficulty: body.difficulty }); return NextResponse.json({ success: true }, { status: 201 });
    }
    if (action === 'admin-create-edge') {
      const source = stringField(body.source, 100); const target = stringField(body.target, 100); const type = stringField(body.type, 50);
      if (!source || !target || !type || typeof body.weight !== 'number') return invalid('Complete edge fields are required.');
      await createAdminEdge({ source, target, type, weight: body.weight }); return NextResponse.json({ success: true }, { status: 201 });
    }
    return invalid('Unknown administrator action.');
  }

  if (action === 'rate-card') {
    const cardId = stringField(body.cardId, 160);
    const status = body.status;
    if (!cardId || (status !== 'known' && status !== 'saved')) return invalid('A valid card and status are required.');
    return NextResponse.json(await saveCardState(cardId, status as CardStatus));
  }

  if (action === 'remove-saved') {
    const cardId = stringField(body.cardId, 160);
    if (!cardId) return invalid('A card is required.');
    return NextResponse.json(await removeSavedCard(cardId));
  }

  if (action === 'reset-progress') return NextResponse.json(await resetUserCardProgress());

  const id = stringField(body.id, 160);
  if (action === 'create-note') {
    const title = stringField(body.title, 240);
    const content = stringField(body.content, 8_000) ?? '';
    const topic = stringField(body.topic, 120) ?? '';
    const requestId = stringField(body.requestId, 160) ?? '';
    if (!title?.trim()) return invalid('A note title is required.');
    await createKnowledgeItem(toFormData({ title, content, topic, request_id: requestId }));
    return NextResponse.json({ success: true }, { status: 201 });
  }

  if (!id) return invalid('A note id is required.');
  if (action === 'update-note') {
    const title = stringField(body.title, 240);
    const content = stringField(body.content, 8_000) ?? '';
    const topic = stringField(body.topic, 120) ?? '';
    if (!title?.trim()) return invalid('A note title is required.');
    await updateKnowledgeItem(toFormData({ id, title, content, topic }));
    return NextResponse.json({ success: true });
  }
  if (action === 'delete-note') {
    await deleteKnowledgeItem(toFormData({ id }));
    return NextResponse.json({ success: true });
  }
  if (action === 'restore-note') {
    await restoreKnowledgeItem(toFormData({ id }));
    return NextResponse.json({ success: true });
  }

  return invalid('Unknown mobile action.');
}
