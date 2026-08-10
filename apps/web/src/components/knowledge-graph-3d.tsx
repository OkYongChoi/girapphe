/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { KnowledgeCard, CardStatus } from '@/actions/card-actions';
import { getCardLevelMeta } from '@stem-brain/graph-engine';
import { formatDomainLabel } from '@stem-brain/graph-engine';
import { getDomainColor } from '@stem-brain/graph-engine';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false }) as any;

type ColorMode = 'progress' | 'domain';

type GraphCard = KnowledgeCard & { status: CardStatus | null };

type Props = {
  cards: GraphCard[];
  onClose?: () => void;
};

type SelectedNode = {
  id: string;
  name: string;
  group?: 'card' | 'domain';
  desc?: string;
  mainContent?: string;
  domain?: string;
  domains?: string[];
  level?: string;
  status?: CardStatus | null;
  wiki_url?: string;
  related_concepts?: string[];
  color?: string;
  conceptCount?: number;
};

const STATUS_COLORS: Record<string, string> = {
  known: '#4ade80',
  saved: '#60a5fa',
  unseen: '#9ca3af',
};

const DOMAIN_HUB_PROGRESS_COLOR = '#cbd5e1';
const MUTED_LINK_COLOR = 'rgba(148, 163, 184, 0.28)';

function getCardDomains(card: GraphCard) {
  return card.domains && card.domains.length > 0 ? card.domains : [card.domain];
}

function getStatusLabel(status: CardStatus | null) {
  if (status === 'known') return 'Explainable';
  if (status === 'saved') return 'Unclear';
  return 'Not started';
}

export default function KnowledgeGraph3D({ cards, onClose }: Props) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [query, setQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<CardStatus | 'all' | 'unstarted'>('all');
  const [colorMode, setColorMode] = useState<ColorMode>('progress');
  const fgRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const domainList = useMemo(
    () => Array.from(new Set(cards.flatMap((card) => card.domains && card.domains.length > 0 ? card.domains : [card.domain]))).sort(),
    [cards]
  );

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cards.filter((card) => {
      const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
      const matchesQuery = normalizedQuery.length === 0
        || card.title.toLowerCase().includes(normalizedQuery)
        || card.summary.toLowerCase().includes(normalizedQuery);
      const matchesDomain = selectedDomain === 'all' || domains.includes(selectedDomain);
      const matchesStatus =
        selectedStatus === 'all'
          ? true
          : selectedStatus === 'unstarted'
            ? card.status === null
            : card.status === selectedStatus;

      return matchesQuery && matchesDomain && matchesStatus;
    });
  }, [cards, query, selectedDomain, selectedStatus]);

  const visibleDomainList = useMemo(
    () => Array.from(new Set(filteredCards.flatMap((card) => card.domains && card.domains.length > 0 ? card.domains : [card.domain]))).sort(),
    [filteredCards]
  );

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const linkSet = new Set<string>();
    const domainCounts = new Map<string, number>();

    filteredCards.forEach((card) => {
      const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
      for (const domain of domains) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
      }
    });

    for (const [domain, count] of [...domainCounts.entries()].sort()) {
      nodes.push({
        id: `domain:${domain}`,
        name: formatDomainLabel(domain),
        val: Math.min(18, Math.max(8, 6 + count / 3)),
        color: colorMode === 'domain' ? getDomainColor(domain) : DOMAIN_HUB_PROGRESS_COLOR,
        group: 'domain',
        domain,
        domains: [domain],
        conceptCount: count,
        desc: `${count} visible concepts in ${formatDomainLabel(domain)}.`,
      });
    }

    // Card nodes
    filteredCards.forEach((card) => {
      const statusColor = STATUS_COLORS[card.status ?? 'unseen'];
      const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
      const primaryDomain = domains[0] ?? card.domain;

      nodes.push({
        id: card.id,
        name: card.title,
        val: card.status === 'known' ? 8 : card.status === 'saved' ? 6 : 4,
        color: colorMode === 'domain' ? getDomainColor(primaryDomain) : statusColor,
        group: 'card',
        desc: card.summary,
        mainContent: card.explanation,
        domain: card.domain,
        domains,
        level: card.level,
        status: card.status,
        wiki_url: card.wiki_url,
        related_concepts: card.related_concepts,
      });

      domains.forEach((domain, index) => {
        links.push({
          source: `domain:${domain}`,
          target: card.id,
          color: colorMode === 'domain' ? `${getDomainColor(domain)}${index === 0 ? '66' : '33'}` : MUTED_LINK_COLOR,
          width: index === 0 ? 0.75 : 0.35,
          particles: colorMode === 'domain' && index === 0 ? 1 : 0,
        });
      });

      // Link card -> related concepts
      if (card.related_concepts) {
        card.related_concepts.forEach((concept) => {
          const targetCard = filteredCards.find(
            (c) => c.title.toLowerCase() === concept.toLowerCase()
          );
          if (targetCard) {
            const pairKey = [card.id, targetCard.id].sort().join('::');
            if (linkSet.has(pairKey)) return;
            linkSet.add(pairKey);
            links.push({
              source: card.id,
              target: targetCard.id,
              color: colorMode === 'progress' ? 'rgba(226,232,240,0.34)' : 'rgba(255,255,255,0.2)',
              width: 0.55,
              particles: 0,
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [colorMode, filteredCards]);

  const selectedDomainCards = useMemo(() => {
    if (selectedNode?.group !== 'domain' || !selectedNode.domain) return [];

    return filteredCards
      .filter((card) => getCardDomains(card).includes(selectedNode.domain as string))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredCards, selectedNode]);

  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode(node);

      // Fly camera to the node
      if (fgRef.current && Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)) {
        const distance = 120;
        const nodeDistance = Math.hypot(node.x, node.y, node.z);
        const distRatio = nodeDistance > 0 ? 1 + distance / nodeDistance : 1;
        fgRef.current.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio,
          },
          node,
          1000
        );
      }
    },
    []
  );

  const focusDomain = useCallback(
    (domain: string) => {
      const domainNode = graphData.nodes.find((node: any) => node.id === `domain:${domain}`);
      if (domainNode) {
        handleNodeClick(domainNode);
        return;
      }

      const count = filteredCards.filter((card) => getCardDomains(card).includes(domain)).length;
      setSelectedNode({
        id: `domain:${domain}`,
        name: formatDomainLabel(domain),
        group: 'domain',
        domain,
        domains: [domain],
        conceptCount: count,
        color: getDomainColor(domain),
        desc: `${count} visible concepts in ${formatDomainLabel(domain)}.`,
      });
    },
    [filteredCards, graphData.nodes, handleNodeClick]
  );

  const handleNodeHover = useCallback((node: any) => {
    document.body.style.cursor = node ? 'pointer' : 'default';
  }, []);
  const selectedLevel = selectedNode?.level ? getCardLevelMeta(selectedNode.level) : null;
  const selectedNodeColorLabel = selectedNode?.group === 'domain'
    ? 'Domain hub'
    : colorMode === 'domain'
      ? 'Domain color'
      : selectedNode?.status ?? 'Not started';

  if (!isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span className="text-sm text-gray-400">Loading 3D Graph...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 3D Graph Canvas */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#030712"
        nodeLabel=""
        nodeVal="val"
        nodeColor="color"
        nodeOpacity={0.9}
        nodeResolution={16}
        linkColor="color"
        linkOpacity={0.58}
        linkWidth={(link: any) => link.width ?? 0.5}
        linkDirectionalParticles={(link: any) => link.particles ?? 0}
        linkDirectionalParticleWidth={0.7}
        linkDirectionalParticleSpeed={0.003}
        enableNodeDrag={true}
        enableNavigationControls={true}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={() => setSelectedNode(null)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-3 px-4 py-4 md:px-6 pointer-events-none">
        <div className="pointer-events-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-gray-800 bg-gray-950/80 p-3 backdrop-blur-sm shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Knowledge Graph
              </h2>
              <p className="text-xs text-gray-400">
                {filteredCards.length} of {cards.length} concepts &middot; {visibleDomainList.length} domains
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedDomain('all');
                setSelectedStatus('all');
                setColorMode('progress');
              }}
              className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_10rem_9rem]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search concepts"
              className="min-h-10 rounded-lg border border-gray-700 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            />
            <select
              value={selectedDomain}
              onChange={(event) => setSelectedDomain(event.target.value)}
              className="min-h-10 rounded-lg border border-gray-700 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            >
              <option value="all">All domains</option>
              {domainList
                .filter((domain) => domain !== 'other')
                .map((domain) => (
                  <option key={domain} value={domain}>
                    {formatDomainLabel(domain)}
                  </option>
                ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as CardStatus | 'all' | 'unstarted')}
              className="min-h-10 rounded-lg border border-gray-700 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            >
              <option value="all">All progress</option>
              <option value="known">Explainable</option>
              <option value="saved">Unclear</option>
              <option value="unstarted">Not started</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Color by</span>
            {[
              { key: 'progress', label: 'Progress' },
              { key: 'domain', label: 'Domain' },
            ].map((item) => {
              const selected = colorMode === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setColorMode(item.key as ColorMode)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-cyan-200/70 bg-cyan-200/15 text-white'
                      : 'border-gray-700 bg-black/20 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-auto relative flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (window.history.length > 1) {
                router.back();
                return;
              }
              router.push('/knowledge');
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/75 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Back
          </button>
          <Link
            href="/practice"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/75 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Practice
          </Link>
          <Link
            href="/"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/75 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Home
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/75 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h7l2 2h9v14H3z" /><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Back to Grid
            </button>
          )}
        </div>
      </div>

      {/* Legend - bottom left */}
      <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-10 max-h-80 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/85 p-4 shadow-xl backdrop-blur-sm md:bottom-6 md:left-6 md:right-auto md:w-72 md:max-h-[28rem]">
        {colorMode === 'progress' ? (
          <>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">Progress Colors</p>
            <div className="space-y-2">
              {[
                { label: 'Explainable', color: STATUS_COLORS.known },
                { label: 'Unclear', color: STATUS_COLORS.saved },
                { label: 'Not Started', color: STATUS_COLORS.unseen },
                { label: 'Domain Hub', color: DOMAIN_HUB_PROGRESS_COLOR },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Domain Colors</p>
              <span className="text-[10px] text-gray-500">Click to inspect</span>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 md:max-h-96">
              {visibleDomainList
                .filter((domain) => domain !== 'other')
                .map((domain) => {
                  const active = selectedNode?.group === 'domain' && selectedNode.domain === domain;
                  const count = filteredCards.filter((card) => getCardDomains(card).includes(domain)).length;

                  return (
                    <button
                      key={domain}
                      type="button"
                      aria-pressed={active}
                      onClick={() => focusDomain(domain)}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'border-white/20 bg-white/10'
                          : 'border-transparent hover:border-white/10 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: getDomainColor(domain) }}
                        />
                        <span className="truncate text-xs text-gray-300">{formatDomainLabel(domain)}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-500">{count}</span>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {/* Node Detail Panel - slides in from right */}
      {selectedNode && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-sm animate-in slide-in-from-right-5 duration-200">
          <div className="h-full overflow-y-auto bg-gray-950/90 backdrop-blur-md border-l border-gray-800 p-6">
            {/* Close button */}
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Status indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedNode.color }}
              />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {selectedNodeColorLabel}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-1">
              {selectedNode.name}
            </h3>

            {/* Domain & Level badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(selectedNode.domains && selectedNode.domains.length > 0 ? selectedNode.domains : selectedNode.domain ? [selectedNode.domain] : []).map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize"
                  style={{
                    backgroundColor: `${getDomainColor(domain)}22`,
                    color: getDomainColor(domain),
                    border: `1px solid ${getDomainColor(domain)}44`,
                  }}
                >
                  {formatDomainLabel(domain)}
                </span>
              ))}
              {selectedNode.level && (
                <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-700">
                  Difficulty {selectedLevel?.rank} · {selectedLevel?.label}
                </span>
              )}
            </div>

            {selectedNode.group === 'domain' && selectedNode.conceptCount ? (
              <div className="mb-5 rounded-lg border border-gray-800 bg-white/[0.04] px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                  Visible Concepts
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{selectedNode.conceptCount}</p>
              </div>
            ) : null}

            {selectedNode.group === 'domain' && selectedDomainCards.length > 0 ? (
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Knowledge in this domain
                </p>
                <div className="space-y-2">
                  {selectedDomainCards.map((card) => {
                    const node = graphData.nodes.find((item: any) => item.id === card.id);

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          if (node) handleNodeClick(node);
                        }}
                        className="w-full rounded-lg border border-gray-800 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-sm font-medium text-white">{card.title}</span>
                          <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-gray-400">
                            {getStatusLabel(card.status)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">
                          {card.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Summary */}
            {selectedNode.desc && (
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                {selectedNode.desc}
              </p>
            )}

            {selectedNode.mainContent && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Main Content
                </p>
                <p className="whitespace-pre-line text-sm text-gray-300 leading-relaxed">
                  {selectedNode.mainContent}
                </p>
              </div>
            )}

            {/* Related concepts */}
            {selectedNode.related_concepts && selectedNode.related_concepts.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Related Concepts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.related_concepts.map((concept: string) => {
                    const linked = filteredCards.some(
                      (c) => c.title.toLowerCase() === concept.toLowerCase()
                    );
                    return (
                      <span
                        key={concept}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          linked
                            ? 'bg-white/10 text-white cursor-pointer hover:bg-white/20 transition-colors'
                            : 'bg-gray-800/50 text-gray-500'
                        }`}
                        onClick={() => {
                          if (linked) {
                            const targetCard = filteredCards.find(
                              (c) => c.title.toLowerCase() === concept.toLowerCase()
                            );
                            if (targetCard) {
                              const node = graphData.nodes.find(
                                (n: any) => n.id === targetCard.id
                              );
                              if (node) handleNodeClick(node);
                            }
                          }
                        }}
                      >
                        {concept}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wiki link */}
            {selectedNode.wiki_url && (
              <a
                href={selectedNode.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-blue-400 hover:bg-white/10 transition-colors border border-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Wikipedia
              </a>
            )}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-10 hidden md:block">
        <p className="text-[10px] text-gray-600">
          Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan
        </p>
      </div>
    </div>
  );
}
