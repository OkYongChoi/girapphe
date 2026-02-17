/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { GraphNodeWithKnowledge, GraphEdge, NodeType } from '@/lib/graph-types';
import { getDomainColor } from '@/lib/graph-types';
import { submitQuizResult } from '@/actions/graph-actions';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false }) as any;

type Props = {
  graphData: {
    nodes: GraphNodeWithKnowledge[];
    links: GraphEdge[];
  };
  onClose?: () => void;
};

type SelectedNode = {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: NodeType;
  knowledge: number;
  confidence: number;
  growth_daily: number;
  growth_weekly: number;
  growth_monthly: number;
  x?: number;
  y?: number;
  z?: number;
};

const KNOWLEDGE_COLORS = {
  high: '#4ade80',    // known (>= 0.8)
  medium: '#facc15',  // partial (0.3 - 0.8)
  low: '#f87171',     // weak (0.01 - 0.3)
  none: '#374151',    // unknown (0)
};

function getKnowledgeColor(k: number): string {
  if (k >= 0.8) return KNOWLEDGE_COLORS.high;
  if (k >= 0.3) return KNOWLEDGE_COLORS.medium;
  if (k > 0) return KNOWLEDGE_COLORS.low;
  return KNOWLEDGE_COLORS.none;
}

function getKnowledgeLabel(k: number): string {
  if (k >= 0.8) return 'Known';
  if (k >= 0.3) return 'Partial';
  if (k > 0) return 'Weak';
  return 'Unknown';
}

const EDGE_TYPE_COLORS: Record<string, string> = {
  prerequisite: 'rgba(59, 130, 246, 0.4)',
  related: 'rgba(255, 255, 255, 0.2)',
  generalizes: 'rgba(168, 85, 247, 0.3)',
  derived_from: 'rgba(34, 197, 94, 0.3)',
  equivalent_to: 'rgba(251, 191, 36, 0.3)',
};

export default function KnowledgeGraph3DNew({ graphData, onClose }: Props) {
  const [isClient, setIsClient] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [colorMode, setColorMode] = useState<'knowledge' | 'domain'>('knowledge');
  const [visibleDomains, setVisibleDomains] = useState<Set<string>>(new Set());
  const [showEdgeTypes, setShowEdgeTypes] = useState<Set<string>>(
    new Set(['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'])
  );
  const fgRef = useRef<any>(null);
  const domainList = useMemo(
    () => [...new Set(graphData.nodes.map((n) => n.domain))].sort(),
    [graphData.nodes]
  );

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

  useEffect(() => {
    setVisibleDomains(new Set(domainList));
  }, [domainList]);

  const focusNode = useCallback((node: any) => {
    setSelectedNode({
      id: node.id,
      label: node.label,
      domain: node.domain,
      level: node.level,
      difficulty: node.difficulty,
      type: node.type,
      knowledge: node.knowledge,
      confidence: node.confidence,
      growth_daily: node.growth_daily,
      growth_weekly: node.growth_weekly,
      growth_monthly: node.growth_monthly,
      x: node.x,
      y: node.y,
      z: node.z,
    });

    if (fgRef.current) {
      const distance = 150;
      const distRatio = 1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      fgRef.current.cameraPosition(
        {
          x: (node.x ?? 0) * distRatio,
          y: (node.y ?? 0) * distRatio,
          z: (node.z ?? 0) * distRatio,
        },
        node,
        1000
      );
    }
  }, []);

  // Transform data for force graph
  const forceData = useMemo(() => {
    const visibleNodeIds = new Set(
      graphData.nodes.filter((n) => visibleDomains.has(n.domain)).map((n) => n.id)
    );

    const nodes = graphData.nodes.map((node) => {
      const color =
        node.type === 'advertisement'
          ? '#fbbf24'
          : colorMode === 'knowledge'
          ? getKnowledgeColor(node.knowledge)
          : getDomainColor(node.domain);

      // Size: base + knowledge contribution + level contribution
      const baseSize = node.level === 0 ? 12 : node.level === 1 ? 8 : 4;
      const knowledgeBonus = node.knowledge * 4;
      const val = baseSize + knowledgeBonus;

      return {
        id: node.id,
        label: node.label,
        domain: node.domain,
        level: node.level,
        difficulty: node.difficulty,
        type: node.type,
        knowledge: node.knowledge,
        confidence: node.confidence,
        growth_daily: node.growth_daily,
        growth_weekly: node.growth_weekly,
        growth_monthly: node.growth_monthly,
        val,
        color,
        opacity: Math.max(0.3, 0.3 + node.knowledge * 0.7),
      };
    });

    const links = graphData.links
      .filter((e) => showEdgeTypes.has(e.type))
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight,
        color: EDGE_TYPE_COLORS[edge.type] ?? 'rgba(255,255,255,0.15)',
      }));

    return {
      nodes: nodes.filter((node) => visibleDomains.has(node.domain)),
      links,
    };
  }, [graphData, colorMode, showEdgeTypes, visibleDomains]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    return forceData.nodes
      .filter((node: any) => node.label.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchTerm, forceData.nodes]);

  const handleNodeClick = useCallback((node: any) => {
    focusNode(node);
  }, [focusNode]);

  const handleQuizAnswer = useCallback(
    async (result: 0 | 0.5 | 1) => {
      if (!selectedNode || quizLoading) return;
      setQuizLoading(true);

      try {
        const res = await submitQuizResult(selectedNode.id, result);
        if (res.success && res.node) {
          setSelectedNode((prev) =>
            prev
              ? {
                  ...prev,
                  knowledge: res.node!.knowledge,
                  confidence: res.node!.confidence,
                }
              : null
          );
        }
      } catch (err) {
        console.error('Quiz submission error:', err);
      } finally {
        setQuizLoading(false);
      }
    },
    [selectedNode, quizLoading]
  );

  const toggleEdgeType = useCallback((type: string) => {
    setShowEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleDomain = useCallback((domain: string) => {
    setVisibleDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectedNode && !visibleDomains.has(selectedNode.domain)) {
      setSelectedNode(null);
    }
  }, [selectedNode, visibleDomains]);

  // Get connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return { prerequisites: [] as string[], dependents: [] as string[], related: [] as string[] };

    const prerequisites: string[] = [];
    const dependents: string[] = [];
    const related: string[] = [];

    for (const edge of graphData.links) {
      if (edge.target === selectedNode.id && edge.type === 'prerequisite') {
        const srcNode = graphData.nodes.find((n) => n.id === edge.source);
        if (srcNode) prerequisites.push(srcNode.label);
      }
      if (edge.source === selectedNode.id && edge.type === 'prerequisite') {
        const tgtNode = graphData.nodes.find((n) => n.id === edge.target);
        if (tgtNode) dependents.push(tgtNode.label);
      }
      if (edge.type === 'related' || edge.type === 'equivalent_to') {
        if (edge.source === selectedNode.id) {
          const tgtNode = graphData.nodes.find((n) => n.id === edge.target);
          if (tgtNode) related.push(tgtNode.label);
        } else if (edge.target === selectedNode.id) {
          const srcNode = graphData.nodes.find((n) => n.id === edge.source);
          if (srcNode) related.push(srcNode.label);
        }
      }
    }

    return { prerequisites, dependents, related };
  }, [selectedNode, graphData]);

  if (!isClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span className="text-sm text-gray-400">Loading 3D Knowledge Graph...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <ForceGraph3D
        ref={fgRef}
        graphData={forceData}
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
        linkWidth={(link: any) => (link.type === 'prerequisite' ? 0.8 : 0.3)}
        linkDirectionalParticles={(link: any) => (link.type === 'prerequisite' ? 2 : 0)}
        linkDirectionalParticleColor={(link: any) =>
          link.type === 'prerequisite' ? 'rgba(96, 165, 250, 0.95)' : 'rgba(255,255,255,0.3)'
        }
        linkDirectionalParticleWidth={0.4}
        linkDirectionalParticleSpeed={0.005}
        enableNodeDrag={true}
        enableNavigationControls={true}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => {
          document.body.style.cursor = node ? 'pointer' : 'default';
        }}
        onBackgroundClick={() => setSelectedNode(null)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={80}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Knowledge Graph
          </h2>
          <p className="text-xs text-gray-500">
            {graphData.nodes.length} concepts &middot;{' '}
            {graphData.links.length} connections &middot; Click a node to inspect
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search concepts..."
              className="w-56 rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-gray-500"
            />
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-gray-700 bg-gray-950/95 p-1 shadow-xl backdrop-blur">
                {searchResults.map((node: any) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      focusNode(node);
                      setSearchTerm('');
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-white/10"
                  >
                    <span className="text-xs text-gray-200">{node.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">{node.domain}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setColorMode('knowledge')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                colorMode === 'knowledge'
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Knowledge
            </button>
            <button
              onClick={() => setColorMode('domain')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                colorMode === 'domain'
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Domain
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Grid View
            </button>
          )}
        </div>
      </div>

      {/* Legend - bottom left */}
      <div className="absolute bottom-6 left-6 z-10 rounded-xl bg-gray-900/80 p-4 backdrop-blur-sm border border-gray-800 pointer-events-auto max-w-[200px]">
        {colorMode === 'knowledge' ? (
          <>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
              Knowledge Level
            </p>
            <div className="space-y-2">
              {[
                { label: 'Known (>80%)', color: KNOWLEDGE_COLORS.high },
                { label: 'Partial (30-80%)', color: KNOWLEDGE_COLORS.medium },
                { label: 'Weak (<30%)', color: KNOWLEDGE_COLORS.low },
                { label: 'Unknown', color: KNOWLEDGE_COLORS.none },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
              Domains
            </p>
            <div className="space-y-2">
              {domainList.map((domain) => (
                <div key={domain} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getDomainColor(domain) }}
                  />
                  <span className="text-xs text-gray-300">{domain}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Edge type filters */}
        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
            Edge Types
          </p>
          <div className="space-y-2">
            {[
              { type: 'prerequisite', label: 'Prerequisite', color: 'rgba(59, 130, 246, 0.8)' },
              { type: 'related', label: 'Related', color: 'rgba(255, 255, 255, 0.5)' },
              { type: 'generalizes', label: 'Generalizes', color: 'rgba(168, 85, 247, 0.8)' },
              { type: 'derived_from', label: 'Derived', color: 'rgba(34, 197, 94, 0.8)' },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => toggleEdgeType(item.type)}
                className="flex items-center gap-2.5 w-full text-left"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-sm flex-shrink-0 transition-opacity ${
                    showEdgeTypes.has(item.type) ? 'opacity-100' : 'opacity-30'
                  }`}
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className={`text-xs transition-opacity ${
                    showEdgeTypes.has(item.type) ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
            Domain Filters
          </p>
          <div className="space-y-2">
            {domainList.map((domain) => (
              <button
                key={domain}
                onClick={() => toggleDomain(domain)}
                className="flex items-center gap-2.5 w-full text-left"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-sm flex-shrink-0 transition-opacity ${
                    visibleDomains.has(domain) ? 'opacity-100' : 'opacity-30'
                  }`}
                  style={{ backgroundColor: getDomainColor(domain) }}
                />
                <span
                  className={`text-xs transition-opacity ${
                    visibleDomains.has(domain) ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {domain}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-sm animate-in slide-in-from-right-5 duration-200">
          <div
            className={`h-full overflow-y-auto bg-gray-950/90 backdrop-blur-md border-l p-6 ${
              selectedNode.type === 'advertisement' ? 'border-amber-500/40' : 'border-gray-800'
            }`}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Knowledge indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getKnowledgeColor(selectedNode.knowledge) }}
              />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {getKnowledgeLabel(selectedNode.knowledge)} &middot;{' '}
                {Math.round(selectedNode.knowledge * 100)}%
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-1">{selectedNode.label}</h3>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedNode.type === 'advertisement' && (
                <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-300">
                  SPONSORED
                </span>
              )}
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${getDomainColor(selectedNode.domain)}22`,
                  color: getDomainColor(selectedNode.domain),
                  border: `1px solid ${getDomainColor(selectedNode.domain)}44`,
                }}
              >
                {selectedNode.domain}
              </span>
              <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-700">
                L{selectedNode.level}
              </span>
              <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-700">
                D{selectedNode.difficulty}
              </span>
              <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400 border border-gray-700 capitalize">
                {selectedNode.type}
              </span>
            </div>

            <div className="mb-6">
              <Link
                href={`/practice?node=${encodeURIComponent(selectedNode.id)}`}
                className="inline-flex w-full items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/25"
              >
                Start Practice
              </Link>
            </div>

            {/* Knowledge bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Knowledge</span>
                <span>{Math.round(selectedNode.knowledge * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${selectedNode.knowledge * 100}%`,
                    backgroundColor: getKnowledgeColor(selectedNode.knowledge),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Confidence</span>
                <span>{Math.round(selectedNode.confidence * 100)}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${selectedNode.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Growth metrics */}
            {(selectedNode.growth_daily > 0 ||
              selectedNode.growth_weekly > 0 ||
              selectedNode.growth_monthly > 0) && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Growth
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Daily', value: selectedNode.growth_daily },
                    { label: 'Weekly', value: selectedNode.growth_weekly },
                    { label: 'Monthly', value: selectedNode.growth_monthly },
                  ]
                    .filter((g) => g.value > 0)
                    .map((g) => (
                      <div
                        key={g.label}
                        className="bg-gray-800/50 rounded-lg p-2 text-center border border-gray-800"
                      >
                        <span className="text-sm font-bold text-green-400">
                          +{Math.round(g.value * 100)}%
                        </span>
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {g.label}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Quiz section */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">
                Self Assessment
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Do you know <span className="text-white font-medium">{selectedNode.label}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuizAnswer(1)}
                  disabled={quizLoading}
                  className="flex-1 rounded-lg bg-green-900/30 border border-green-800 px-3 py-2 text-sm font-medium text-green-400 hover:bg-green-900/50 transition-colors disabled:opacity-50"
                >
                  Known
                </button>
                <button
                  onClick={() => handleQuizAnswer(0.5)}
                  disabled={quizLoading}
                  className="flex-1 rounded-lg bg-yellow-900/30 border border-yellow-800 px-3 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-900/50 transition-colors disabled:opacity-50"
                >
                  Partial
                </button>
                <button
                  onClick={() => handleQuizAnswer(0)}
                  disabled={quizLoading}
                  className="flex-1 rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50"
                >
                  Unknown
                </button>
              </div>
            </div>

            {/* Prerequisites */}
            {connectedNodes.prerequisites.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Prerequisites
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {connectedNodes.prerequisites.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-blue-900/30 border border-blue-800/50 px-2.5 py-1 text-xs text-blue-300 cursor-pointer hover:bg-blue-900/50 transition-colors"
                      onClick={() => {
                        const node = forceData.nodes.find(
                          (n: any) => n.label === name
                        );
                        if (node) handleNodeClick(node);
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependents */}
            {connectedNodes.dependents.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Unlocks
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {connectedNodes.dependents.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-purple-900/30 border border-purple-800/50 px-2.5 py-1 text-xs text-purple-300 cursor-pointer hover:bg-purple-900/50 transition-colors"
                      onClick={() => {
                        const node = forceData.nodes.find(
                          (n: any) => n.label === name
                        );
                        if (node) handleNodeClick(node);
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related */}
            {connectedNodes.related.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
                  Related
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {connectedNodes.related.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-gray-300 cursor-pointer hover:bg-white/20 transition-colors"
                      onClick={() => {
                        const node = forceData.nodes.find(
                          (n: any) => n.label === name
                        );
                        if (node) handleNodeClick(node);
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
