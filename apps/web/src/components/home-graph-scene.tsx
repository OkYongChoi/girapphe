/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  known: { color: '#22c55e', label: 'Known' },
  saved: { color: '#38bdf8', label: 'Saved' },
  notes: { color: '#f59e0b', label: 'Notes' },
  core: { color: '#94a3b8', label: 'Concepts' },
};

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

  const enableOrbit = () => {
    const controls = graphRef.current?.controls?.();
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.enablePan = false;
    controls.minDistance = 90;
    controls.maxDistance = 430;
  };

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
          val: group.val + (index % 3),
          color: NODE_GROUPS[group.key].color,
        });
      }
    });

    const links: any[] = nodes
      .filter((node) => node.id !== 'stem-brain')
      .map((node, index) => ({
        source: index % 4 === 0 ? nodes[Math.max(1, index - 1)].id : 'stem-brain',
        target: node.id,
        color: node.group === 'core' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(226, 232, 240, 0.36)',
        width: node.group === 'core' ? 0.35 : 0.65,
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
  }, [known, saved, notes]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_26%_68%,rgba(245,158,11,0.18),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_54%,#111827_100%)]" />
      <div className="absolute inset-y-0 right-[-12%] w-[82%] opacity-95 md:right-[-4%] md:w-[68%]">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel=""
          nodeVal="val"
          nodeColor="color"
          nodeOpacity={0.95}
          nodeResolution={20}
          linkColor="color"
          linkOpacity={0.9}
          linkWidth={(link: any) => link.width}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={0.45}
          linkDirectionalParticleSpeed={0.0035}
          enableNodeDrag={false}
          enableNavigationControls={false}
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
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
    </div>
  );
}
