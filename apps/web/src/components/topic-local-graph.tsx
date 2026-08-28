import type {
  TopicKnowledgeHubItem,
  TopicKnowledgeRelation,
} from '@/lib/topic-knowledge-hub';
import { getServerI18n } from '@/i18n/server';
import type { MessageKey } from '@/i18n/messages';

const MAX_DRAWN_NODES = 24;

type PositionedNode = {
  item: TopicKnowledgeHubItem;
  x: number;
  y: number;
};

function privateItemId(value: string) {
  return value.startsWith('personal:') ? value.slice('personal:'.length) : null;
}

function shortLabel(value: string, max = 24) {
  const characters = Array.from(value);
  return characters.length <= max ? value : `${characters.slice(0, max - 1).join('')}…`;
}

function isDirected(type: string) {
  return type !== 'related' && type !== 'equivalent_to';
}

function positions(items: TopicKnowledgeHubItem[]): PositionedNode[] {
  const visible = items.slice(0, MAX_DRAWN_NODES);
  if (visible.length === 1) return [{ item: visible[0]!, x: 380, y: 210 }];

  return visible.map((item, index) => {
    const angle = -Math.PI / 2 + (index / visible.length) * Math.PI * 2;
    return {
      item,
      x: 380 + Math.cos(angle) * 278,
      y: 210 + Math.sin(angle) * 154,
    };
  });
}

function relationLabel(relation: TopicKnowledgeRelation) {
  return relation.type.replaceAll('_', ' ');
}

export default async function TopicLocalGraph({
  items,
  relations,
}: {
  items: TopicKnowledgeHubItem[];
  relations: TopicKnowledgeRelation[];
}) {
  const { t } = await getServerI18n();
  const labels = new Map(items.map((item) => [item.id, item.title]));
  const displayEndpoint = (value: string) => {
    const itemId = privateItemId(value);
    if (itemId) return labels.get(itemId) ?? t('topic.graph.privateItem', { id: shortLabel(itemId, 14) });
    return t('topic.graph.atlasConcept', { id: shortLabel(value.replace(/^public:/, ''), 18) });
  };
  const nodes = positions(items);
  const nodeById = new Map(nodes.map((node) => [node.item.id, node]));
  const visibleEdges = relations.flatMap((relation) => {
    const sourceId = privateItemId(relation.source);
    const targetId = privateItemId(relation.target);
    const source = sourceId ? nodeById.get(sourceId) : null;
    const target = targetId ? nodeById.get(targetId) : null;
    return source && target ? [{ relation, source, target }] : [];
  });

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        {t('topic.graph.empty')}
      </div>
    );
  }

  return (
    <figure aria-labelledby="topic-local-graph-title" className="grid gap-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-2 shadow-sm">
        <svg
          viewBox="0 0 760 420"
          role="img"
          aria-labelledby="topic-local-graph-title topic-local-graph-description"
          className="min-h-[20rem] w-full min-w-[42rem]"
        >
          <title id="topic-local-graph-title">{t('topic.graph.title')}</title>
          <desc id="topic-local-graph-description">
            {t('topic.graph.description')}
          </desc>
          <defs>
            <marker id="topic-edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <filter id="topic-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#020617" floodOpacity="0.35" />
            </filter>
          </defs>

          {visibleEdges.map(({ relation, source, target }) => (
            <g key={relation.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={relation.relation_origin === 'model_inferred' ? '#a78bfa' : '#94a3b8'}
                strokeWidth="2"
                strokeDasharray={relation.relation_origin === 'model_inferred' ? '7 6' : undefined}
                markerEnd={isDirected(relation.type) ? 'url(#topic-edge-arrow)' : undefined}
              />
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 7}
                textAnchor="middle"
                className="fill-slate-300 text-[10px]"
              >
                {shortLabel(relationLabel(relation), 18)}
              </text>
            </g>
          ))}

          {nodes.map(({ item, x, y }) => (
            <a key={item.id} href={`#item-${encodeURIComponent(item.id)}`} aria-label={t('topic.graph.open', { title: item.title })}>
              <g transform={`translate(${x} ${y})`} filter="url(#topic-node-shadow)">
                <rect
                  x="-78"
                  y="-28"
                  width="156"
                  height="56"
                  rx="14"
                  fill={item.knowledge_type === 'question' ? '#312e81' : item.knowledge_type === 'decision' ? '#713f12' : item.knowledge_type === 'event' ? '#164e63' : '#0f3f78'}
                  stroke={item.last_verified_at ? '#6ee7b7' : '#93c5fd'}
                  strokeWidth="2"
                />
                <text textAnchor="middle" y="-4" className="fill-white text-[12px] font-semibold">
                  {shortLabel(item.title, 22)}
                </text>
                <text textAnchor="middle" y="14" className="fill-slate-300 text-[9px] uppercase tracking-wide">
                  {item.knowledge_type ? t(`bundle.type.${item.knowledge_type}` as MessageKey) : t('topic.graph.legacy')} · v{item.version}
                </text>
              </g>
            </a>
          ))}

          {items.length > MAX_DRAWN_NODES ? (
            <text x="380" y="405" textAnchor="middle" className="fill-slate-300 text-[11px]">
              {t('topic.graph.showing', { shown: MAX_DRAWN_NODES, total: items.length })}
            </text>
          ) : null}
        </svg>
      </div>

      <div className="grid gap-2" aria-label={t('topic.graph.relationships')}>
        {relations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
            {t('topic.graph.noRelations')}
          </p>
        ) : (
          relations.map((relation) => (
            <div key={relation.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{displayEndpoint(relation.source)}</span>
              <span aria-hidden="true" className="text-slate-400">{isDirected(relation.type) ? '→' : '↔'}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{relationLabel(relation)}</span>
              <span aria-hidden="true" className="text-slate-400">{isDirected(relation.type) ? '→' : '↔'}</span>
              <span className="font-semibold text-slate-950">{displayEndpoint(relation.target)}</span>
              <span className={`ms-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${relation.relation_origin === 'explicit_user' ? 'bg-emerald-100 text-emerald-800' : relation.relation_origin === 'model_inferred' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'}`}>
                {t(`topic.graph.origin.${relation.relation_origin}` as MessageKey)}
              </span>
            </div>
          ))
        )}
      </div>
    </figure>
  );
}
