import React from 'react';
import { EmotionalLandscapeData, LandscapeNode } from '../../types/landscape';

interface EmotionalLandscape2DFallbackProps {
  landscapeData: EmotionalLandscapeData;
  selectedNodeId: string | null;
  onSelectNode: (node: LandscapeNode | null) => void;
  onHoverNode?: (node: LandscapeNode | null) => void;
}

// Generate organic 2D amoeboid SVG path from form and radius
function generateAmoebaPath(form: LandscapeNode['outerForm'], r: number): string {
  const points = 8;
  const coords: [number, number][] = [];

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    let radius = r;

    if (form === 'compressed_dense') {
      radius *= i % 2 === 0 ? 1.15 : 0.8;
    } else if (form === 'folded_inward') {
      radius *= angle > Math.PI ? 0.75 : 1.1;
    } else if (form === 'swollen_unstable') {
      radius *= 1.0 + 0.2 * Math.sin(angle * 3);
    } else if (form === 'smooth_expansive') {
      radius *= 1.0 + 0.1 * Math.cos(angle * 2);
    } else {
      radius *= 1.0 + 0.12 * Math.sin(angle * 2.5);
    }

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    coords.push([x, y]);
  }

  // Smooth closed path using quadratic beziers
  let d = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < points; i++) {
    const p0 = coords[i];
    const p1 = coords[(i + 1) % points];
    const midX = (p0[0] + p1[0]) / 2;
    const midY = (p0[1] + p1[1]) / 2;
    d += ` Q ${p0[0]},${p0[1]} ${midX},${midY}`;
  }
  d += ' Z';
  return d;
}

export const EmotionalLandscape2DFallback: React.FC<EmotionalLandscape2DFallbackProps> = ({
  landscapeData,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
}) => {
  const nodeMap = new Map<string, LandscapeNode>();
  landscapeData.nodes.forEach((n) => nodeMap.set(n.id, n));

  // Map 3D positions [-16..16] to 2D SVG canvas [100..700]
  const projectX = (x: number) => 400 + x * 20;
  const projectY = (y: number, z: number) => 300 + y * 14 + z * 8;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none bg-[#0a0a0d] overflow-hidden">
      <div className="absolute top-4 left-6 z-10">
        <span className="text-[11.5px] text-[#71717a] bg-[#141418] px-2.5 py-1 rounded-[6px] border border-[rgba(255,255,255,0.06)]">
          2D Atmospheric Fallback
        </span>
      </div>

      <svg
        viewBox="0 0 800 600"
        className="w-full h-full max-w-5xl"
        onClick={() => onSelectNode(null)}
      >
        {/* 1. Atmospheric Connection Strands */}
        <g className="connections">
          {landscapeData.connections.map((conn) => {
            const src = nodeMap.get(conn.sourceId);
            const tgt = nodeMap.get(conn.targetId);
            if (!src || !tgt) return null;

            const x1 = projectX(src.position[0]);
            const y1 = projectY(src.position[1], src.position[2]);
            const x2 = projectX(tgt.position[0]);
            const y2 = projectY(tgt.position[1], tgt.position[2]);

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2 - 18 * conn.strength;

            const isSelected = selectedNodeId === src.id || selectedNodeId === tgt.id;

            return (
              <path
                key={conn.id}
                d={`M ${x1},${y1} Q ${midX},${midY} ${x2},${y2}`}
                fill="none"
                stroke={
                  conn.relationshipType === 'conflicts_with'
                    ? '#63494e'
                    : conn.relationshipType === 'comforts'
                    ? '#64748b'
                    : '#52525b'
                }
                strokeWidth={Math.max(1, conn.strength * 2)}
                strokeOpacity={isSelected ? 0.6 : 0.15}
                className="transition-all duration-300"
              />
            );
          })}
        </g>

        {/* 2. Organic Amoeba Nodes */}
        <g className="nodes">
          {landscapeData.nodes.map((node) => {
            const cx = projectX(node.position[0]);
            const cy = projectY(node.position[1], node.position[2]);
            const isSelected = node.id === selectedNodeId;
            const r = node.baseRadius * 11;
            const outerPath = generateAmoebaPath(node.outerForm, r);
            const innerPath = generateAmoebaPath(node.outerForm, r * 0.55);

            return (
              <g
                key={node.id}
                transform={`translate(${cx}, ${cy})`}
                className="cursor-pointer transition-transform duration-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                onMouseEnter={() => onHoverNode?.(node)}
                onMouseLeave={() => onHoverNode?.(null)}
              >
                {/* Outer Amoeba Shell */}
                <path
                  d={outerPath}
                  fill={node.colorSpec.baseColor}
                  fillOpacity={node.colorSpec.opacity * 0.8}
                  stroke={node.colorSpec.rimColor}
                  strokeWidth={isSelected ? 1.8 : 0.8}
                  strokeOpacity={isSelected ? 0.8 : 0.35}
                />

                {/* Inner Cellular Density Layer (Not a white circle) */}
                <path
                  d={innerPath}
                  fill={node.colorSpec.innerGlowColor}
                  fillOpacity={0.25}
                />

                {/* Discreet Label */}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fill={isSelected ? '#f5f5f7' : '#86868b'}
                  fontSize={node.category === 'central_incident' ? 12 : 10.5}
                  fontWeight={isSelected ? 500 : 400}
                  className="pointer-events-none tracking-tight select-none"
                >
                  {node.shortLabel}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
