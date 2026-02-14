'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { KnowledgeCard, CardStatus } from '@/actions/card-actions';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false }) as any;

type Props = {
  cards: (KnowledgeCard & { status: CardStatus | null })[];
  onClose?: () => void;
};

type SelectedNode = {
  id: string;
  name: string;
  desc?: string;
  domain?: string;
  level?: string;
  status?: CardStatus | null;
  wiki_url?: string;
  related_concepts?: string[];
  isDomain?: boolean;
  color?: string;
};

const STATUS_COLORS: Record<string, string> = {
  known: '#4ade80',
  saved: '#60a5fa',
  unknown: '#f87171',
  unseen: '#6b7280',
};

const DOMAIN_COLORS: Record<string, string> = {
  signal: '#f97316',
  control: '#3b82f6',
  info: '#22c55e',
  ml: '#a855f7',
  other: '#6b7280',
};

export default function KnowledgeGraph3D({ cards, onClose }: Props) {
  const [isClient, setIsClient] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
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

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    const domains = new Set(cards.map((c) => c.domain));

    // Domain hub nodes
    domains.forEach((domain) => {
      nodes.push({
        id: `domain_${domain}`,
        name: domain.charAt(0).toUpperCase() + domain.slice(1),
        val: 25,
        color: DOMAIN_COLORS[domain] || DOMAIN_COLORS.other,
        group: 'domain',
        isDomain: true,
      });
    });

    // Card nodes
    cards.forEach((card) => {
      const statusColor = STATUS_COLORS[card.status ?? 'unseen'];

      nodes.push({
        id: card.id,
        name: card.title,
        val: card.status === 'known' ? 8 : card.status === 'saved' ? 6 : 4,
        color: statusColor,
        group: 'card',
        desc: card.summary,
        domain: card.domain,
        level: card.level,
        status: card.status,
        wiki_url: card.wiki_url,
        related_concepts: card.related_concepts,
      });

      // Link card -> domain hub
      links.push({
        source: card.id,
        target: `domain_${card.domain}`,
        color: `${DOMAIN_COLORS[card.domain] || DOMAIN_COLORS.other}44`,
      });

      // Link card -> related concepts
      if (card.related_concepts) {
        card.related_concepts.forEach((concept) => {
          const targetCard = cards.find(
            (c) => c.title.toLowerCase() === concept.toLowerCase()
          );
          if (targetCard) {
            links.push({
              source: card.id,
              target: targetCard.id,
              color: 'rgba(255,255,255,0.35)',
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [cards]);

  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode(node);

      // Fly camera to the node
      if (fgRef.current) {
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
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

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id ?? null);
    document.body.style.cursor = node ? 'pointer' : 'default';
  }, []);

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
        linkOpacity={0.6}
        linkWidth={0.5}
        linkDirectionalParticles={0}
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
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Knowledge Graph
          </h2>
          <p className="text-xs text-gray-500">
            {cards.length} concepts &middot; Click a node to inspect
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h7l2 2h9v14H3z" /><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Grid View
          </button>
        )}
      </div>

      {/* Legend - bottom left */}
      <div className="absolute bottom-6 left-6 z-10 rounded-xl bg-gray-900/80 p-4 backdrop-blur-sm border border-gray-800 pointer-events-none">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">Status</p>
        <div className="space-y-2">
          {[
            { label: 'Known', color: STATUS_COLORS.known },
            { label: 'Saved', color: STATUS_COLORS.saved },
            { label: 'Review', color: STATUS_COLORS.unknown },
            { label: 'Unseen', color: STATUS_COLORS.unseen },
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

        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">Domains</p>
          <div className="space-y-2">
            {Object.entries(DOMAIN_COLORS)
              .filter(([key]) => key !== 'other')
              .map(([domain, color]) => (
                <div key={domain} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-300 capitalize">{domain}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Node Detail Panel - slides in from right */}
      {selectedNode && !selectedNode.isDomain && (
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
                {selectedNode.status ?? 'Unseen'}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-1">
              {selectedNode.name}
            </h3>

            {/* Domain & Level badges */}
            <div className="flex gap-2 mb-5">
              {selectedNode.domain && (
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize"
                  style={{
                    backgroundColor: `${DOMAIN_COLORS[selectedNode.domain] || DOMAIN_COLORS.other}22`,
                    color: DOMAIN_COLORS[selectedNode.domain] || DOMAIN_COLORS.other,
                    border: `1px solid ${DOMAIN_COLORS[selectedNode.domain] || DOMAIN_COLORS.other}44`,
                  }}
                >
                  {selectedNode.domain}
                </span>
              )}
              {selectedNode.level && (
                <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-700">
                  {selectedNode.level}
                </span>
              )}
            </div>

            {/* Summary */}
            {selectedNode.desc && (
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                {selectedNode.desc}
              </p>
            )}

            {/* Related concepts */}
            {selectedNode.related_concepts && selectedNode.related_concepts.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Related Concepts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.related_concepts.map((concept: string) => {
                    const linked = cards.some(
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
                            const targetCard = cards.find(
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

      {/* Domain hub detail */}
      {selectedNode && selectedNode.isDomain && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-sm animate-in slide-in-from-right-5 duration-200">
          <div className="h-full overflow-y-auto bg-gray-950/90 backdrop-blur-md border-l border-gray-800 p-6">
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <span
                className="h-4 w-4 rounded-sm"
                style={{
                  backgroundColor:
                    DOMAIN_COLORS[selectedNode.name.toLowerCase()] || DOMAIN_COLORS.other,
                }}
              />
              <h3 className="text-xl font-bold text-white capitalize">
                {selectedNode.name}
              </h3>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
              Concepts in this domain
            </p>
            <div className="space-y-2">
              {cards
                .filter((c) => c.domain === selectedNode.name.toLowerCase())
                .map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      const node = graphData.nodes.find(
                        (n: any) => n.id === card.id
                      );
                      if (node) handleNodeClick(node);
                    }}
                    className="w-full text-left rounded-lg bg-gray-800/50 p-3 hover:bg-gray-800 transition-colors border border-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[card.status ?? 'unseen'],
                        }}
                      />
                      <span className="text-sm text-white font-medium truncate">
                        {card.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-4 truncate">
                      {card.summary}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600">
          Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan
        </p>
      </div>
    </div>
  );
}
