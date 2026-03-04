import React from 'react';
import { MindMapNode } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface Props {
  nodes: MindMapNode[];
}

export const MindMapConnections: React.FC<Props> = ({ nodes }) => {
  return (
    <>
      <defs>
        {/* Unique gradient for each connection */}
        {nodes.filter(n => n.parentId).map(node => {
          const palette = getBranchPalette(node.id, nodes);
          return (
            <linearGradient
              key={`grad-${node.id}`}
              id={`conn-grad-${node.id}`}
              x1="0%" y1="0%" x2="100%" y2="0%"
            >
              <stop offset="0%" stopColor={palette.line} stopOpacity={0.15} />
              <stop offset="40%" stopColor={palette.line} stopOpacity={0.5} />
              <stop offset="100%" stopColor={palette.line} stopOpacity={0.7} />
            </linearGradient>
          );
        })}
      </defs>

      {nodes.filter(n => n.parentId).map(node => {
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return null;

        const depth = getNodeDepth(node.id, nodes);
        const parentDepth = getNodeDepth(parent.id, nodes);

        const strokeW = depth === 1 ? 2.5 : depth === 2 ? 1.8 : 1.2;

        // Anchor to right edge of parent, left edge of child
        const parentOffsetX = parentDepth === 0 ? 130 : parentDepth === 1 ? 105 : 65;
        const childOffsetX = depth === 1 ? 0 : 6;

        const sx = parent.x + parentOffsetX;
        const sy = parent.y;
        const ex = node.x - childOffsetX;
        const ey = node.y;

        const dx = Math.abs(ex - sx);
        const cpX = Math.max(dx * 0.45, 30);

        // S-curve with vertical easing
        const d = `M ${sx} ${sy} C ${sx + cpX} ${sy}, ${ex - cpX} ${ey}, ${ex} ${ey}`;

        return (
          <path
            key={`conn-${parent.id}-${node.id}`}
            d={d}
            stroke={`url(#conn-grad-${node.id})`}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            className="transition-opacity duration-300"
          />
        );
      })}
    </>
  );
};
