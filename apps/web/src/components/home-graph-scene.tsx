/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-slate-400">
      Building graph...
    </div>
  ),
}) as any;

type HomeGraphSceneProps = {
  known: number;
  saved: number;
  notes: number;
};

const NODE_GROUPS = {
  known: { color: '#22c55e', hotColor: '#86efac', label: 'Known' },
  saved: { color: '#38bdf8', hotColor: '#7dd3fc', label: 'Saved' },
  notes: { color: '#f59e0b', hotColor: '#fcd34d', label: 'Notes' },
  core: { color: '#94a3b8', label: 'Concepts' },
};

type ActiveGroup = keyof Pick<typeof NODE_GROUPS, 'known' | 'saved' | 'notes'>;

const GROUP_SEQUENCE: ActiveGroup[] = ['known', 'saved', 'notes'];

const TOPICS = [
  'Linear Systems',
  'Bayes Rule',
  'Control Loops',
  'Fourier Analysis',
  'Neural Nets',
  'Graph Search',
  'Optimization',
  'Signals',
  'State Space',
  'Databases',
  'Computer Vision',
  'Probability',
  'Embedded IO',
  'Compilers',
  'Distributed Systems',
  'Feedback',
  'Transforms',
  'Planning',
];

export default function HomeGraphScene({ known, saved, notes }: HomeGraphSceneProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 720, height: 560 });
  const [activeGroup, setActiveGroup] = useState<ActiveGroup>('known');
  const [hoveredLabel, setHoveredLabel] = useState('Live knowledge graph');

  useEffect(() => {
    const element = wrapperRef.current;
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
    const intervalId = window.setInterval(() => {
      setActiveGroup((current) => {
        const index = GROUP_SEQUENCE.indexOf(current);
        return GROUP_SEQUENCE[(index + 1) % GROUP_SEQUENCE.length];
      });
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, []);

  const enableOrbit = useCallback(() => {
    const controls = graphRef.current?.controls?.();
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = activeGroup === 'saved' ? 0.78 : activeGroup === 'notes' ? 0.42 : 0.6;
    controls.enablePan = false;
    controls.minDistance = 90;
    controls.maxDistance = 430;
  }, [activeGroup]);

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
    const knownCount = Math.min(9, Math.max(3, Math.ceil(known / 2)));
    const savedCount = Math.min(7, Math.max(3, Math.ceil(saved / 2)));
    const noteCount = Math.min(6, Math.max(2, notes));
    const coreCount = 12;

    const nodes: any[] = [
      {
        id: 'stem-brain',
        name: 'STEMBrain',
        group: 'center',
        val: 18,
        color: '#f8fafc',
      },
    ];

    const groups = [
      { key: 'known', count: knownCount, start: 0, val: 7 },
      { key: 'saved', count: savedCount, start: 6, val: 6 },
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
          val: group.val + (index % 3) + (group.key === activeGroup ? 3 : 0),
          color:
            group.key !== 'core' && group.key === activeGroup
              ? NODE_GROUPS[group.key].hotColor
              : NODE_GROUPS[group.key].color,
        });
      }
    });

    const links: any[] = nodes
      .filter((node) => node.id !== 'stem-brain')
      .map((node, index) => ({
        source: index % 4 === 0 ? nodes[Math.max(1, index - 1)].id : 'stem-brain',
        target: node.id,
        active: node.group === activeGroup,
        color:
          node.group === activeGroup
            ? 'rgba(125, 211, 252, 0.72)'
            : node.group === 'core'
              ? 'rgba(148, 163, 184, 0.18)'
              : 'rgba(226, 232, 240, 0.34)',
        width: node.group === activeGroup ? 1.15 : node.group === 'core' ? 0.35 : 0.65,
      }));

    for (let index = 2; index < nodes.length; index += 3) {
      links.push({
        source: nodes[index - 1].id,
        target: nodes[index].id,
        color: 'rgba(56, 189, 248, 0.18)',
        width: 0.25,
      });
    }

    return { nodes, links };
  }, [activeGroup, known, saved, notes]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      className="pointer-events-none absolute inset-0 overflow-hidden [--pointer-x:72%] [--pointer-y:36%]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_26%_68%,rgba(245,158,11,0.18),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_54%,#111827_100%)]" />
      <div className="home-grid-lines absolute inset-0 opacity-60" />
      <div className="home-scan-beam absolute inset-y-[-20%] left-[52%] w-24 rotate-12 bg-gradient-to-r from-transparent via-cyan-300/16 to-transparent blur-sm" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--pointer-x)_var(--pointer-y),rgba(255,255,255,0.18),transparent_18rem)] transition-[background] duration-300" />
      <div className="absolute right-[8%] top-[16%] hidden h-52 w-52 rounded-full border border-cyan-200/15 md:block home-orbit-ring" />
      <div className="absolute right-[18%] top-[28%] hidden h-80 w-80 rounded-full border border-emerald-200/10 md:block home-orbit-ring home-orbit-ring-slow" />
      <div className="pointer-events-auto absolute inset-y-0 right-[-12%] w-[82%] opacity-95 md:right-[-4%] md:w-[68%]">
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
            setHoveredLabel(node?.name ?? NODE_GROUPS[activeGroup].label);
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
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,0.86)_38%,rgba(2,6,23,0.42)_70%,rgba(2,6,23,0.18)_100%)]" />
      <div className="absolute bottom-8 right-6 hidden w-64 rounded-lg border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-300 shadow-2xl shadow-cyan-950/30 backdrop-blur-md md:block">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold uppercase text-slate-400">Signal</span>
          <span className="text-cyan-100">{hoveredLabel}</span>
        </div>
        <div className="mt-3 grid grid-cols-12 gap-1">
          {Array.from({ length: 24 }, (_, index) => (
            <span
              key={index}
              className="home-signal-bar rounded-full bg-cyan-200/60"
              style={{
                animationDelay: `${index * 80}ms`,
                height: `${14 + ((index * 7) % 30)}px`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
    </div>
  );
}
