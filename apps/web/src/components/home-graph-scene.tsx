/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import * as THREE from 'three';
import type { ForceGraphData } from '@stem-brain/graph-engine';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => null,
}) as any;

type HomeGraphSceneProps = {
  demo?: boolean;
  explainable: number;
  unclear: number;
  notes: number;
  personalizedGraphData?: ForceGraphData | null;
};

const NODE_GROUPS = {
  explainable: { color: '#22c55e', hotColor: '#86efac', label: 'Explainable' },
  unclear: { color: '#38bdf8', hotColor: '#7dd3fc', label: 'Unclear' },
  notes: { color: '#f59e0b', hotColor: '#fcd34d', label: 'Notes' },
  core: { color: '#94a3b8', label: 'Concepts' },
  biology: { color: '#34d399', hotColor: '#a7f3d0', label: 'Biology' },
  computing: { color: '#38bdf8', hotColor: '#bae6fd', label: 'Computing' },
  medicine: { color: '#f472b6', hotColor: '#fbcfe8', label: 'Medicine' },
  engineering: { color: '#fbbf24', hotColor: '#fde68a', label: 'Engineering' },
  economics: { color: '#a78bfa', hotColor: '#ddd6fe', label: 'Economics' },
  design: { color: '#2dd4bf', hotColor: '#99f6e4', label: 'Design' },
};

type StatusGroup = keyof Pick<typeof NODE_GROUPS, 'explainable' | 'unclear' | 'notes'>;
type DemoGroup = keyof Pick<typeof NODE_GROUPS, 'biology' | 'computing' | 'medicine' | 'engineering' | 'economics' | 'design'>;
type ActiveGroup = StatusGroup | DemoGroup;

const STATUS_GROUP_SEQUENCE: StatusGroup[] = ['explainable', 'unclear', 'notes'];
const DEMO_GROUP_SEQUENCE: DemoGroup[] = ['biology', 'computing', 'medicine', 'engineering', 'economics', 'design'];

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

const DEMO_DOMAIN_GROUPS = [
  {
    key: 'biology',
    val: 7,
    topics: ['Cell Signaling', 'Protein Folding', 'Genomics', 'Immunology', 'Epidemiology', 'Enzyme Kinetics', 'Neural Plasticity'],
  },
  {
    key: 'computing',
    val: 7,
    topics: ['Graph Algorithms', 'Operating Systems', 'Databases', 'Neural Networks', 'Computer Architecture', 'Distributed Consensus', 'Compiler Design'],
  },
  {
    key: 'medicine',
    val: 6,
    topics: ['Clinical Trials', 'Medical Imaging', 'Pharmacokinetics', 'Biostatistics', 'Diagnostic Tests', 'Pathophysiology', 'Drug Metabolism'],
  },
  {
    key: 'engineering',
    val: 6,
    topics: ['Semiconductor Physics', 'Control Theory', 'Materials Science', 'VLSI Design', 'Structural Engineering', 'Thermal Systems', 'Signal Integrity'],
  },
  {
    key: 'economics',
    val: 5,
    topics: ['Microeconomics', 'Behavioral Economics', 'Econometrics', 'Market Design', 'Game Theory', 'Causal Inference', 'Mechanism Design'],
  },
  {
    key: 'design',
    val: 5,
    topics: ['Urban Systems', 'Sustainable Design', 'Architecture Systems', 'Human Factors', 'Design Systems', 'Spatial Reasoning', 'Service Design'],
  },
] as const;

function getNodeId(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && 'id' in node) return String((node as { id: string }).id);
  return '';
}

function getPersonalizedNodeGroup(knowledge: number) {
  if (knowledge >= 0.75) return 'explainable';
  if (knowledge >= 0.25) return 'unclear';
  return 'core';
}

function getPersonalizedNodeColor(knowledge: number, active: boolean) {
  if (knowledge >= 0.75) return active ? NODE_GROUPS.explainable.hotColor : NODE_GROUPS.explainable.color;
  if (knowledge >= 0.25) return active ? NODE_GROUPS.unclear.hotColor : NODE_GROUPS.unclear.color;
  return active ? '#cbd5e1' : NODE_GROUPS.core.color;
}

function makeNodeGeometry(node: any, shapeVariant: number) {
  const value = Number(node.val ?? 5);
  const radius = Math.max(3.2, Math.min(12, value * 0.9));
  const selector = node.group === 'center' ? 0 : (shapeVariant + Number(node.shapeSeed ?? 0)) % 5;

  if (selector === 0) return new THREE.IcosahedronGeometry(radius, 1);
  if (selector === 1) return new THREE.BoxGeometry(radius * 1.45, radius * 1.45, radius * 1.45);
  if (selector === 2) return new THREE.ConeGeometry(radius, radius * 2.2, 6);
  if (selector === 3) return new THREE.OctahedronGeometry(radius * 1.1, 0);
  return new THREE.TorusGeometry(radius * 0.8, radius * 0.24, 8, 18);
}

export default function HomeGraphScene({ demo = false, explainable, unclear, notes, personalizedGraphData }: HomeGraphSceneProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 720, height: 560 });
  const [activeGroup, setActiveGroup] = useState<ActiveGroup>(demo ? 'biology' : 'explainable');
  const [shapeVariant, setShapeVariant] = useState(0);
  const [demoGraphClicked, setDemoGraphClicked] = useState(false);

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
    const groupSequence: readonly ActiveGroup[] = demo ? DEMO_GROUP_SEQUENCE : STATUS_GROUP_SEQUENCE;

    const intervalId = window.setInterval(() => {
      setActiveGroup((current) => {
        const index = groupSequence.indexOf(current);
        return groupSequence[(index + 1) % groupSequence.length];
      });
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, [demo]);

  const enableOrbit = useCallback(() => {
    const controls = graphRef.current?.controls?.();
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = activeGroup === 'unclear' ? 0.78 : activeGroup === 'notes' ? 0.42 : 0.6;
    controls.enablePan = false;
    controls.minDistance = 90;
    controls.maxDistance = 430;
  }, [activeGroup]);

  useEffect(() => {
    enableOrbit();
  }, [enableOrbit]);

  useEffect(() => {
    if (!demo || demoGraphClicked) return;

    const intervalId = window.setInterval(() => {
      setShapeVariant((current) => (current + 1) % 5);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [demo, demoGraphClicked]);

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
    if (!demo && personalizedGraphData?.nodes?.length) {
      const nodes = personalizedGraphData.nodes.map((node, index) => {
        const group = getPersonalizedNodeGroup(node.knowledge);
        const active = group === activeGroup;
        return {
          id: node.id,
          name: node.label,
          group,
          domain: node.domain,
          val: 4 + node.level + node.difficulty + node.knowledge * 5,
          color: getPersonalizedNodeColor(node.knowledge, active),
          shapeSeed: index,
        };
      });
      const activeNodeIds = new Set(nodes.filter((node) => node.group === activeGroup).map((node) => node.id));
      const links = personalizedGraphData.links.map((link) => {
        const source = getNodeId(link.source);
        const target = getNodeId(link.target);
        const active = activeNodeIds.has(source) || activeNodeIds.has(target);
        return {
          source,
          target,
          active,
          color: active ? 'rgba(125, 211, 252, 0.72)' : 'rgba(226, 232, 240, 0.24)',
          width: active ? 1.05 : 0.34 + link.weight * 0.32,
        };
      });

      return { nodes, links };
    }

    if (demo) {
      const nodes: any[] = [
        {
          id: 'stem-brain',
          name: 'STEMBrain',
          group: 'center',
          val: 20,
          color: '#f8fafc',
        },
      ];

      DEMO_DOMAIN_GROUPS.forEach((group) => {
        group.topics.forEach((topic, index) => {
          nodes.push({
            id: `${group.key}-${index}`,
            name: topic,
            group: group.key,
            val: group.val + (index % 3) + (group.key === activeGroup ? 3 : 0),
            color: group.key === activeGroup ? NODE_GROUPS[group.key].hotColor : NODE_GROUPS[group.key].color,
            shapeSeed: index,
          });
        });
      });

      const links: any[] = nodes
        .filter((node) => node.id !== 'stem-brain')
        .map((node, index) => ({
          source: index % 5 === 0 ? nodes[Math.max(1, index - 2)].id : 'stem-brain',
          target: node.id,
          active: node.group === activeGroup,
          color: node.group === activeGroup ? 'rgba(125, 211, 252, 0.72)' : 'rgba(226, 232, 240, 0.3)',
          width: node.group === activeGroup ? 1.15 : 0.55,
        }));

      for (let index = 3; index < nodes.length; index += 2) {
        links.push({
          source: nodes[index - 2].id,
          target: nodes[index].id,
          color: 'rgba(45, 212, 191, 0.18)',
          width: 0.28,
        });
      }

      return { nodes, links };
    }

    const explainableCount = Math.min(9, Math.max(3, Math.ceil(explainable / 2)));
    const unclearCount = Math.min(7, Math.max(3, Math.ceil(unclear / 2)));
    const noteCount = Math.min(6, Math.max(2, notes));
    const coreCount = Math.max(12, 40 - (1 + explainableCount + unclearCount + noteCount));

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
          val: group.val + (index % 3) + (group.key === activeGroup ? 3 : 0),
          color:
            group.key !== 'core' && group.key === activeGroup
              ? NODE_GROUPS[group.key].hotColor
              : NODE_GROUPS[group.key].color,
          shapeSeed: index,
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
  }, [activeGroup, demo, explainable, notes, personalizedGraphData, unclear]);

  const nodeThreeObject = useCallback(
    (node: any) => {
      const geometry = makeNodeGeometry(node, demo && !demoGraphClicked ? shapeVariant : Number(node.shapeSeed ?? 0));
      const material = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: node.group === activeGroup || node.group === 'center' ? 0.32 : 0.14,
        metalness: 0.18,
        roughness: 0.48,
        transparent: true,
        opacity: 0.94,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(
        ((Number(node.shapeSeed ?? 0) % 4) * Math.PI) / 9,
        ((Number(node.shapeSeed ?? 0) % 6) * Math.PI) / 8,
        0
      );
      return mesh;
    },
    [activeGroup, demo, demoGraphClicked, shapeVariant]
  );

  const stopDemoShapeChanges = useCallback(() => {
    if (demo) setDemoGraphClicked(true);
  }, [demo]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden [--pointer-x:72%] [--pointer-y:36%]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_26%_68%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#0b1120_54%,#111827_100%)]" />
      <div className="home-grid-lines absolute inset-0 opacity-55" />
      <div className="home-map-contours absolute inset-0 opacity-35" />
      <div className="home-scan-beam absolute inset-y-[-20%] left-[52%] w-16 rotate-12 bg-gradient-to-r from-transparent via-cyan-300/[0.08] to-transparent blur-sm" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--pointer-x)_var(--pointer-y),rgba(255,255,255,0.08),transparent_18rem)] transition-[background] duration-300" />
      <div ref={graphContainerRef} className="home-graph-canvas pointer-events-auto absolute inset-y-0 left-1/2 w-[120%] -translate-x-1/2 opacity-95 md:w-[92%] lg:w-[82%]">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={(node: any) => node.name}
          nodeVal="val"
          nodeColor="color"
          nodeThreeObject={nodeThreeObject}
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
          onNodeClick={stopDemoShapeChanges}
          onBackgroundClick={stopDemoShapeChanges}
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
    </div>
  );
}
