import React, { useMemo } from 'react';
import { MindMapNode } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface Props {
  nodes: MindMapNode[];
}

export const MindMapConnections: React.FC<Props> = ({ nodes }) => {
  const connections = useMemo(() => {
    return nodes.filter(n => n.parentId).map(node => {
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;

      const palette = getBranchPalette(node.id, nodes);
      const depth = getNodeDepth(node.id, nodes);
      const parentDepth = getNodeDepth(parent.id, nodes);

      const strokeW = depth === 1 ? 2.5 : depth === 2 ? 1.8 : 1.2;

      // Simple left/right detection: compare raw x positions
      const isLeft = node.x < parent.x;

      const parentHalfW = parentDepth === 0 ? 130 : parentDepth === 1 ? 105 : 65;
      const childHalfW = depth === 1 ? 105 : depth === 2 ? 65 : 50;

      let sx: number, sy: number, ex: number, ey: number;

      if (isLeft) {
        // Child is to the left: exit parent's left edge → enter child's right edge
        sx = parent.x - parentHalfW;
        sy = parent.y;
        ex = node.x + childHalfW;
        ey = node.y;
      } else {
        // Child is to the right: exit parent's right edge → enter child's left edge
        sx = parent.x + parentHalfW;
        sy = parent.y;
        ex = node.x - (depth === 1 ? 0 : 6);
        ey = node.y;
      }

      const dx = Math.abs(ex - sx);
      const cpX = Math.max(dx * 0.45, 30);

      const d = isLeft
        ? `M ${sx} ${sy} C ${sx - cpX} ${sy}, ${ex + cpX} ${ey}, ${ex} ${ey}`
        : `M ${sx} ${sy} C ${sx + cpX} ${sy}, ${ex - cpX} ${ey}, ${ex} ${ey}`;

      return {
        key: `conn-${parent.id}-${node.id}`,
        gradId: `conn-grad-${node.id}`,
        lineColor: palette.line,
        d,
        strokeW,
        isLeft,
      };
    }).filter(Boolean) as {
      key: string;
      gradId: string;
      lineColor: string;
      d: string;
      strokeW: number;
      isLeft: boolean;
    }[];
  }, [nodes]);

  return (
    <g>
      <defs>
        {connections.map(c => (
          <linearGradient
            key={`grad-${c.key}`}
            id={c.gradId}
            x1={c.isLeft ? "100%" : "0%"} y1="0%"
            x2={c.isLeft ? "0%" : "100%"} y2="0%"
          >
            <stop offset="0%" stopColor={c.lineColor} stopOpacity={0.15} />
            <stop offset="40%" stopColor={c.lineColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={c.lineColor} stopOpacity={0.7} />
          </linearGradient>
        ))}
      </defs>

      {connections.map(c => (
        <path
          key={c.key}
          d={c.d}
          stroke={`url(#${c.gradId})`}
          strokeWidth={c.strokeW}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
};
