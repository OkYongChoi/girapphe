export type DraftDependencyInput = {
  id: string;
  clientCardId?: string;
  relations: Array<{
    targetKind: 'public' | 'private' | 'draft';
    targetId: string;
  }>;
};

export function draftDependencies(drafts: readonly DraftDependencyInput[]) {
  const draftIdByReference = new Map<string, string>();
  for (const draft of drafts) {
    draftIdByReference.set(draft.id, draft.id);
    if (draft.clientCardId) draftIdByReference.set(draft.clientCardId, draft.id);
  }

  return new Map(drafts.map((draft) => {
    const dependencies = new Set<string>();
    for (const relation of draft.relations) {
      if (relation.targetKind !== 'draft') continue;
      const reference = relation.targetId.replace(/^draft:/, '');
      const dependencyId = draftIdByReference.get(reference);
      if (dependencyId && dependencyId !== draft.id) dependencies.add(dependencyId);
    }
    return [draft.id, dependencies] as const;
  }));
}

export function includeDraftDependencies(
  selectedIds: ReadonlySet<string>,
  dependencies: ReadonlyMap<string, ReadonlySet<string>>
) {
  const expanded = new Set(selectedIds);
  const queue = [...selectedIds];
  while (queue.length > 0) {
    const sourceId = queue.pop();
    if (!sourceId) continue;
    for (const dependencyId of dependencies.get(sourceId) ?? []) {
      if (expanded.has(dependencyId)) continue;
      expanded.add(dependencyId);
      queue.push(dependencyId);
    }
  }
  return expanded;
}
