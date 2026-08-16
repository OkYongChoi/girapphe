import { NextRequest, NextResponse } from 'next/server';
import { parseAcceptLanguage } from '@stem-brain/shared';
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
import { readBoundedJson } from '@/lib/billing/bounded-json';
import { handlePublicContentRequest } from '@/lib/public-content-api';
import { parseContentLocale } from '@/lib/content-localization';

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
  return NextResponse.json({ error: 'Sign in is required.', code: 'AUTH_REQUIRED' }, { status: 401 });
}

function invalid(message: string, code = 'INVALID_REQUEST') {
  return NextResponse.json({ error: message, code }, { status: 400 });
}

function stringField(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

async function readBody(request: NextRequest) {
  const result = await readBoundedJson(request, MAX_JSON_BYTES);
  if (!result.ok) return result;
  const value = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false as const, reason: 'invalid_json' as const };
  }
  return { ok: true as const, value: value as Record<string, unknown> };
}

function toFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function mutationResponse(result: { success?: boolean; error?: string }) {
  if (result.success === false) {
    return NextResponse.json(
      { error: result.error === 'guest_card_not_available' ? 'This card is not available.' : 'The change could not be saved.' },
      { status: result.error === 'guest_card_not_available' ? 400 : 500 },
    );
  }
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get('resource');
  if (resource === 'content') return handlePublicContentRequest(request);
  if (!await requireMobileUser()) return unauthorized();
  const explicitLocale = request.nextUrl.searchParams.get('locale');
  const localeInput = explicitLocale
    ?? request.headers.get('x-girapphe-locale')
    ?? parseAcceptLanguage(request.headers.get('accept-language'));
  const parsedLocale = parseContentLocale(localeInput);
  if (!parsedLocale) return invalid('The requested locale is not supported.', 'UNSUPPORTED_LOCALE');
  const locale = parsedLocale;

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
      const [cards, personalItems] = await Promise.all([
        getAllCardsWithStatus({ locale }),
        getUserKnowledgeItems(),
      ]);
      return NextResponse.json({
        cards: cards.map((card) => ({ id: card.id, title: card.title, status: card.status })),
        personalItems: personalItems.map((item) => ({ id: item.id, title: item.title, topic: item.topic })),
      });
    }
    case 'practice': {
      const mode = request.nextUrl.searchParams.get('mode') === 'review' ? 'review' : 'new';
      const exclude = request.nextUrl.searchParams.getAll('exclude').filter((id) => id.length <= 160).slice(0, 100);
      const [card, stats] = await Promise.all([getNextCard(mode, exclude, locale), getUserStats()]);
      return NextResponse.json({ card, stats });
    }
    case 'saved':
      return NextResponse.json({ cards: await getSavedCards(locale) });
    case 'dashboard': {
      const [stats, domains] = await Promise.all([getUserStats(), getUserCardDomainProgress(locale)]);
      return NextResponse.json({ stats, domains });
    }
    case 'ranking': {
      const rows = await getCardLeaderboard();
      return NextResponse.json({
        rows: rows.map((row, index) => ({
          rank: index + 1,
          label: `Learner ${index + 1}`,
          explainable: row.explainable,
          avgScore: row.avgScore,
        })),
      });
    }
    default:
      return invalid('Unknown mobile resource.', 'UNKNOWN_MOBILE_RESOURCE');
  }
}

export async function POST(request: NextRequest) {
  if (!await requireMobileUser()) return unauthorized();
  const parsedBody = await readBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === 'too_large' ? 'The request body is too large.' : 'A small JSON object is required.' },
      { status: parsedBody.reason === 'too_large' ? 413 : 400 },
    );
  }
  const body = parsedBody.value;

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
    return mutationResponse(await saveCardState(cardId, status as CardStatus));
  }

  if (action === 'remove-saved') {
    const cardId = stringField(body.cardId, 160);
    if (!cardId) return invalid('A card is required.');
    return mutationResponse(await removeSavedCard(cardId));
  }

  if (action === 'reset-progress') return mutationResponse(await resetUserCardProgress());

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

  return invalid('Unknown mobile action.', 'UNKNOWN_MOBILE_ACTION');
}
