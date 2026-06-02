/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => null,
}) as any;

type HomeGraphSceneProps = {
  explainable: number;
  unclear: number;
  notes: number;
};

type LearningCaseKey = 'explore' | 'review' | 'notes' | 'mastery';

const NODE_GROUPS = {
  explainable: { color: '#22c55e', hotColor: '#86efac', label: 'Explainable' },
  unclear: { color: '#38bdf8', hotColor: '#7dd3fc', label: 'Unclear' },
  notes: { color: '#f59e0b', hotColor: '#fcd34d', label: 'Notes' },
  core: { color: '#94a3b8', label: 'Concepts' },
};

type ActiveGroup = keyof Pick<typeof NODE_GROUPS, 'explainable' | 'unclear' | 'notes'>;

const LEARNING_CASES: Record<
  LearningCaseKey,
  {
    label: string;
    shortLabel: string;
    activeGroup: ActiveGroup;
    summary: string;
    signal: string;
    orbitSpeed: number;
    focus: Record<ActiveGroup, number>;
    coreBoost: number;
    bridgeEvery: number;
    flowColor: string;
  }
> = {
  explore: {
    label: 'New topic exploration',
    shortLabel: 'Explore',
    activeGroup: 'unclear',
    summary: 'Fresh concepts appear as a wider frontier around the graph.',
    signal: 'Frontier expands',
    orbitSpeed: 0.78,
    focus: { explainable: 0.82, unclear: 1.42, notes: 0.72 },
    coreBoost: 1.18,
    bridgeEvery: 4,
    flowColor: 'rgba(125, 211, 252, 0.78)',
  },
  review: {
    label: 'Weak spot review',
    shortLabel: 'Review',
    activeGroup: 'unclear',
    summary: 'Review items tighten into a visible cluster for focused practice.',
    signal: 'Weak cluster tightens',
    orbitSpeed: 0.48,
    focus: { explainable: 0.65, unclear: 1.76, notes: 0.68 },
    coreBoost: 0.86,
    bridgeEvery: 3,
    flowColor: 'rgba(56, 189, 248, 0.86)',
  },
  notes: {
    label: 'Personal note synthesis',
    shortLabel: 'Notes',
    activeGroup: 'notes',
    summary: 'Saved notes become bridges between distant disciplines.',
    signal: 'Notes bridge domains',
    orbitSpeed: 0.36,
    focus: { explainable: 0.78, unclear: 0.82, notes: 1.82 },
    coreBoost: 1,
    bridgeEvery: 2,
    flowColor: 'rgba(252, 211, 77, 0.82)',
  },
  mastery: {
    label: 'Mastery propagation',
    shortLabel: 'Mastery',
    activeGroup: 'explainable',
    summary: 'Explainable concepts push confidence into nearby prerequisites.',
    signal: 'Mastery spreads',
    orbitSpeed: 0.62,
    focus: { explainable: 1.72, unclear: 0.72, notes: 0.92 },
    coreBoost: 1.08,
    bridgeEvery: 3,
    flowColor: 'rgba(134, 239, 172, 0.82)',
  },
};

const CASE_SEQUENCE = Object.keys(LEARNING_CASES) as LearningCaseKey[];

const TOPICS = [
  'Cell Signaling',
  'Graph Algorithms',
  'Semiconductor Physics',
  'Protein Folding',
  'Bayesian Inference',
  'Clinical Trials',
  'Microeconomics',
  'Urban Systems',
  'Organic Chemistry',
  'Computer Architecture',
  'Epidemiology',
  'Control Theory',
  'Behavioral Economics',
  'Neural Networks',
  'Biostatistics',
  'Materials Science',
  'Pharmacokinetics',
  'Sustainable Design',
  'Operating Systems',
  'Genomics',
  'Market Design',
  'Thermodynamics',
  'Structural Engineering',
  'Medical Imaging',
  'Databases',
  'Immunology',
  'Econometrics',
  'VLSI Design',
];

export default function HomeGraphScene({ explainable, unclear, notes }: HomeGraphSceneProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 720, height: 560 });
  const [activeCaseKey, setActiveCaseKey] = useState<LearningCaseKey>('explore');
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const activeCase = LEARNING_CASES[activeCaseKey];
  const activeGroup = activeCase.activeGroup;

  useEffect(() => {
    const element = graphContainerRef.current;
    if (!element) return;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(420, Math.round(rect.height)),
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isAutoCycling) return;

    const intervalId = window.setInterval(() => {
      setActiveCaseKey((current) => {
        const index = CASE_SEQUENCE.indexOf(current);
        return CASE_SEQUENCE[(index + 1) % CASE_SEQUENCE.length];
      });
    }, 3400);

    return () => window.clearInterval(intervalId);
  }, [isAutoCycling]);

  const enableOrbit = useCallback(() => {
    const controls = graphRef.current?.controls?.();
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = activeCase.orbitSpeed;
    controls.enablePan = false;
    controls.minDistance = 90;
    controls.maxDistance = 430;
  }, [activeCase.orbitSpeed]);

  useEffect(() => {
    enableOrbit();
  }, [enableOrbit]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const element = wrapperRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    element.style.setProperty('--pointer-x', `${x.toFixed(1)}%`);
    element.style.setProperty('--pointer-y', `${y.toFixed(1)}%`);
  }, []);

  const graphData = useMemo(() => {
    const explainableCount = Math.min(12, Math.max(3, Math.ceil((explainable / 2) * activeCase.focus.explainable)));
    const unclearCount = Math.min(12, Math.max(3, Math.ceil((unclear / 2) * activeCase.focus.unclear)));
    const noteCount = Math.min(10, Math.max(2, Math.ceil(notes * activeCase.focus.notes)));
    const coreCount = Math.min(16, Math.max(8, Math.round(12 * activeCase.coreBoost)));

    const nodes: any[] = [
      {
        id: 'stem-brain',
        name: 'STEMBrain',
        group: 'center',
        val: activeCaseKey === 'mastery' ? 21 : 18,
        color: '#f8fafc',
      },
    ];

    const groups = [
      { key: 'explainable', count: explainableCount, start: 0, val: 7 },
      { key: 'unclear', count: unclearCount, start: 6, val: 6 },
      { key: 'notes', count: noteCount, start: 11, val: 5 },
      { key: 'core', count: coreCount, start: 3, val: 4 },
    ] as const;

    groups.forEach((group) => {
      for (let index = 0; index < group.count; index += 1) {
        const topic = TOPICS[(group.start + index) % TOPICS.length];
        nodes.push({
          id: `${group.key}-${index}`,
          name: topic,
          group: group.key,
          val: group.val + (index % 3) + (group.key === activeGroup ? 4 : 0),
          color:
            group.key !== 'core' && group.key === activeGroup
              ? NODE_GROUPS[group.key].hotColor
              : NODE_GROUPS[group.key].color,
          case: activeCaseKey,
        });
      }
    });

    const links: any[] = nodes
      .filter((node) => node.id !== 'stem-brain')
      .map((node, index) => ({
        source:
          activeCaseKey === 'review' && node.group === 'unclear'
            ? nodes[Math.max(1, index - 1)].id
            : activeCaseKey === 'notes' && node.group !== 'notes' && index % 3 === 0
              ? `notes-${index % Math.max(1, noteCount)}`
              : index % activeCase.bridgeEvery === 0
                ? nodes[Math.max(1, index - 1)].id
                : 'stem-brain',
        target: node.id,
        active: node.group === activeGroup,
        color:
          node.group === activeGroup
            ? activeCase.flowColor
            : node.group === 'core'
              ? 'rgba(148, 163, 184, 0.18)'
              : 'rgba(226, 232, 240, 0.34)',
        width: node.group === activeGroup ? 1.3 : node.group === 'core' ? 0.35 : 0.65,
      }));

    for (let index = 2; index < nodes.length; index += activeCase.bridgeEvery) {
      links.push({
        source: nodes[index - 1].id,
        target: nodes[index].id,
        active: activeCaseKey === 'notes' || activeCaseKey === 'mastery',
        color: activeCaseKey === 'notes' ? 'rgba(252, 211, 77, 0.38)' : 'rgba(56, 189, 248, 0.18)',
        width: activeCaseKey === 'notes' ? 0.55 : 0.25,
      });
    }

    if (activeCaseKey === 'mastery') {
      nodes
        .filter((node) => node.group === 'explainable')
        .slice(0, 6)
        .forEach((node, index) => {
          links.push({
            source: node.id,
            target: nodes[(index * 3 + 4) % nodes.length].id,
            active: true,
            color: 'rgba(134, 239, 172, 0.44)',
            width: 0.72,
          });
        });
    }

    return { nodes, links };
  }, [activeCase, activeCaseKey, activeGroup, explainable, unclear, notes]);

  return (
    <div
      ref={wrapperRef}
      aria-label="Animated learning-case knowledge graph"
      onPointerMove={handlePointerMove}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden [--pointer-x:72%] [--pointer-y:36%]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_26%_68%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#0b1120_54%,#111827_100%)]" />
      <div className="home-grid-lines absolute inset-0 opacity-55" />
      <div className="home-map-contours absolute inset-0 opacity-35" />
      <div className="home-scan-beam absolute inset-y-[-20%] left-[52%] w-16 rotate-12 bg-gradient-to-r from-transparent via-cyan-300/[0.08] to-transparent blur-sm" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--pointer-x)_var(--pointer-y),rgba(255,255,255,0.08),transparent_18rem)] transition-[background] duration-300" />
      <div ref={graphContainerRef} aria-hidden="true" className="home-graph-canvas pointer-events-auto absolute inset-y-0 left-1/2 w-[120%] -translate-x-1/2 opacity-95 md:w-[92%] lg:w-[82%]">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={(node: any) => node.name}
          nodeVal="val"
          nodeColor="color"
          nodeOpacity={0.95}
          nodeResolution={20}
          linkColor="color"
          linkOpacity={0.9}
          linkWidth={(link: any) => link.width}
          linkDirectionalParticles={(link: any) => (link.active ? 4 : 1)}
          linkDirectionalParticleWidth={(link: any) => (link.active ? 0.9 : 0.42)}
          linkDirectionalParticleSpeed={(link: any) => (link.active ? 0.008 : 0.003)}
          enableNodeDrag={false}
          enableNavigationControls={true}
          onNodeHover={(node: any) => {
            document.body.style.cursor = node ? 'crosshair' : 'default';
          }}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.24}
          warmupTicks={90}
          cooldownTicks={Infinity}
          onEngineStop={() => {
            enableOrbit();
            graphRef.current?.zoomToFit?.(650, 42);
          }}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0%,rgba(2,6,23,0.08)_58%,rgba(2,6,23,0.5)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
      <div className="pointer-events-auto absolute left-4 right-4 top-4 z-10 grid gap-3 md:left-6 md:right-auto md:max-w-sm">
        <div className="rounded-lg border border-white/10 bg-slate-950/72 p-4 shadow-xl shadow-black/25 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase text-cyan-100/70">Learning case</p>
          <h3 className="mt-2 text-lg font-bold text-white">{activeCase.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{activeCase.summary}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NODE_GROUPS[activeGroup].hotColor }} />
            {activeCase.signal}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CASE_SEQUENCE.map((caseKey) => {
            const learningCase = LEARNING_CASES[caseKey];
            const selected = caseKey === activeCaseKey;

            return (
              <button
                key={caseKey}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setIsAutoCycling(false);
                  setActiveCaseKey(caseKey);
                }}
                className={`min-h-10 rounded-lg border px-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-200/60 ${
                  selected
                    ? 'border-cyan-200/60 bg-cyan-200/20 text-white shadow-lg shadow-cyan-950/20'
                    : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-white/25 hover:bg-white/[0.1]'
                }`}
              >
                {learningCase.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
