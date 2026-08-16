export type PersonalizedGraphNote = {
  id: string;
  title: string;
  topic: string;
};

type PersonalizedConceptNode = {
  id: string;
  label: string;
  domain: string;
};

const TOKEN_ALIASES: Record<string, string[]> = {
  ai: ['artificial', 'intelligence'],
  cs: ['computer', 'science'],
  ml: ['machine', 'learning'],
};

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to']);

const HTML_TOOLTIP_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeGraphTooltipText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_TOOLTIP_ENTITIES[character] ?? character);
}

function getTokens(value: string): Set<string> {
  const rawTokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const expanded = rawTokens.flatMap((token) => [token, ...(TOKEN_ALIASES[token] ?? [])]);
  return new Set(expanded);
}

function countOverlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

export function getPersonalizedNoteGraphAdditions(
  notes: PersonalizedGraphNote[],
  conceptNodes: PersonalizedConceptNode[],
  maxNotes = 10
) {
  const limitedNotes = notes.slice(0, Math.max(0, maxNotes));
  const nodes = limitedNotes.map((note, index) => ({
    id: `personal-note:${note.id}`,
    name: note.title,
    group: 'notes' as const,
    domain: note.topic || 'Personal notes',
    val: 6,
    shapeSeed: conceptNodes.length + index,
  }));

  const links = limitedNotes.flatMap((note) => {
    const topicTokens = getTokens(note.topic);
    const noteTokens = getTokens(`${note.topic} ${note.title}`);
    const targets = conceptNodes
      .map((node) => {
        const domainTokens = getTokens(node.domain);
        const labelTokens = getTokens(node.label);
        return {
          id: node.id,
          domain: node.domain,
          score:
            countOverlap(topicTokens, domainTokens) * 4 +
            countOverlap(noteTokens, labelTokens) * 3 +
            countOverlap(noteTokens, domainTokens),
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

    const selected: typeof targets = [];
    for (const target of targets) {
      if (selected.some((candidate) => candidate.domain === target.domain)) continue;
      selected.push(target);
      if (selected.length === 2) break;
    }

    return selected.map((target) => ({
      source: target.id,
      target: `personal-note:${note.id}`,
      relationship: 'topic_match' as const,
    }));
  });

  return { nodes, links };
}
