'use server';

import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/auth';
import {
  approveKnowledgeDraftsForUser,
  createMcpAccessTokenForUser,
  discardKnowledgeDraftBatchForUser,
  getKnowledgeDraftBatchForUser,
  getKnowledgeDraftBatchesForUser,
  getKnowledgeLinkTargetsForUser,
  getMcpAccessTokensForUser,
  revokeMcpAccessTokenForUser,
  sanitizeProposedRelations,
  updateKnowledgeDraftForUser,
  type KnowledgeCardDraft,
  type KnowledgeDraftBatch,
  type KnowledgeLinkTarget,
  type McpAccessToken,
} from '@/lib/knowledge-ingestion';

export type {
  KnowledgeCardDraft,
  KnowledgeDraftBatch,
  KnowledgeLinkTarget,
  McpAccessToken,
  ProposedKnowledgeRelation,
} from '@/lib/knowledge-ingestion';

function revalidateKnowledgeSurfaces(batchId?: string) {
  revalidatePath('/knowledge-inbox');
  if (batchId) revalidatePath(`/knowledge-inbox/${batchId}`);
  revalidatePath('/my-knowledge');
  revalidatePath('/knowledge');
}

export async function getKnowledgeDraftBatches(): Promise<KnowledgeDraftBatch[]> {
  const user = await requireCurrentUser();
  return getKnowledgeDraftBatchesForUser(user.id);
}

export async function getKnowledgeDraftBatch(batchId: string): Promise<{ batch: KnowledgeDraftBatch; drafts: KnowledgeCardDraft[] } | null> {
  const user = await requireCurrentUser();
  return getKnowledgeDraftBatchForUser(user.id, batchId);
}

export async function updateKnowledgeDraft(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const draftId = String(formData.get('draft_id') ?? '').trim();
  if (!draftId) return;
  let relations: unknown = [];
  try {
    relations = JSON.parse(String(formData.get('relations_json') ?? '[]'));
  } catch {
    relations = [];
  }
  const expectedVersionValue = Number(formData.get('version'));
  if (!Number.isInteger(expectedVersionValue) || expectedVersionValue <= 0) return;
  const updated = await updateKnowledgeDraftForUser(user.id, draftId, {
    title: String(formData.get('title') ?? ''),
    summary: String(formData.get('summary') ?? ''),
    explanation: String(formData.get('explanation') ?? ''),
    topic: String(formData.get('topic') ?? ''),
    tags: String(formData.get('tags') ?? '').split(',').map((tag) => tag.trim()),
    relations: sanitizeProposedRelations(relations),
    expectedVersion: expectedVersionValue,
  });
  if (!updated) throw new Error('This draft changed before your edit was saved. Reload it and try again.');
  revalidateKnowledgeSurfaces(String(formData.get('batch_id') ?? '') || undefined);
}

export async function approveKnowledgeDrafts(formData: FormData): Promise<{ approved: number; skippedEdges: number }> {
  const user = await requireCurrentUser();
  const batchId = String(formData.get('batch_id') ?? '').trim();
  if (!batchId) return { approved: 0, skippedEdges: 0 };
  const approveAll = String(formData.get('approve_all') ?? '') === 'true';
  const repeatedIds = formData.getAll('draft_id').map(String).map((id) => id.trim()).filter(Boolean);
  let jsonIds: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get('draft_ids') ?? '[]'));
    if (Array.isArray(parsed)) jsonIds = parsed.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean);
  } catch {
    jsonIds = [];
  }
  const selectedIds = approveAll ? null : Array.from(new Set([...repeatedIds, ...jsonIds]));
  if (selectedIds?.length === 0) return { approved: 0, skippedEdges: 0 };
  let draftVersions: Record<string, number> = {};
  try {
    const parsed = JSON.parse(String(formData.get('draft_versions') ?? '{}')) as Record<string, unknown>;
    draftVersions = Object.fromEntries(Object.entries(parsed)
      .filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && Number(entry[1]) > 0)
      .map(([id, version]) => [id, Number(version)]));
  } catch {
    draftVersions = {};
  }
  const result = await approveKnowledgeDraftsForUser(user.id, batchId, selectedIds, draftVersions);
  revalidateKnowledgeSurfaces(batchId);
  return result;
}

export async function discardKnowledgeDraftBatch(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const batchId = String(formData.get('batch_id') ?? '').trim();
  if (!batchId) return;
  await discardKnowledgeDraftBatchForUser(user.id, batchId);
  revalidateKnowledgeSurfaces(batchId);
}

export async function getKnowledgeLinkTargets(query = ''): Promise<KnowledgeLinkTarget[]> {
  const user = await requireCurrentUser();
  return getKnowledgeLinkTargetsForUser(user.id, query);
}

export async function getMcpAccessTokens(): Promise<McpAccessToken[]> {
  const user = await requireCurrentUser();
  return getMcpAccessTokensForUser(user.id);
}

export async function createMcpAccessToken(formData: FormData): Promise<{ token: string; record: McpAccessToken }> {
  const user = await requireCurrentUser();
  const result = await createMcpAccessTokenForUser(user.id, String(formData.get('label') ?? 'MCP client'));
  revalidatePath('/knowledge-inbox');
  return result;
}

export async function revokeMcpAccessToken(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const tokenId = String(formData.get('token_id') ?? '').trim();
  if (!tokenId) return;
  await revokeMcpAccessTokenForUser(user.id, tokenId);
  revalidatePath('/knowledge-inbox');
}
