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
        const parentDepth = getNodeDepth(parent.id, nodes);

        const strokeW = depth === 1 ? 3 : depth === 2 ? 2 : 1.5;
        const opacity = depth === 1 ? 0.6 : depth === 2 ? 0.45 : 0.35;

        // Offset start point to RIGHT edge of parent node
        const parentOffsetX = parentDepth === 0 ? 120 : parentDepth === 1 ? 100 : 60;
        // Offset end point to LEFT edge of child node
        const childOffsetX = depth === 1 ? 100 : depth === 2 ? 8 : 8;

        const sx = parent.x + parentOffsetX;
        const sy = parent.y;
        const ex = node.x - childOffsetX;
        const ey = node.y;

        const dx = ex - sx;
        const cpOffset = Math.max(Math.abs(dx) * 0.5, 40);

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
