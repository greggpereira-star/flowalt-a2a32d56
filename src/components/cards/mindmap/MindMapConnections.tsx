import React from 'react';
import { MindMapNode } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface Props {
  nodes: MindMapNode[];
}

export const MindMapConnections: React.FC<Props> = ({ nodes }) => {
  return (
    <>
      {nodes.filter(n => n.parentId).map(node => {
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return null;

        const palette = getBranchPalette(node.id, nodes);
        const depth = getNodeDepth(node.id, nodes);

        // Stroke width decreases with depth
        const strokeW = depth === 1 ? 4 : depth === 2 ? 2.5 : 1.8;
        const opacity = depth === 1 ? 0.7 : depth === 2 ? 0.55 : 0.4;

        const sx = parent.x;
        const sy = parent.y;
        const ex = node.x;
        const ey = node.y;

        // MindMeister organic S-curve:
        // Horizontal bezier with control points at ~50% dx
        const dx = ex - sx;
        const cpOffset = Math.abs(dx) * 0.5;

        const d = `M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${ex - cpOffset} ${ey}, ${ex} ${ey}`;

        return (
          <path
            key={`conn-${parent.id}-${node.id}`}
            d={d}
            stroke={palette.line}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </>
  );
};
