import React, { useMemo } from 'react';
import { MindMapNode } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface Props {
  nodes: MindMapNode[];
}

const MindMapConnectionsInner: React.FC<Props> = ({ nodes }) => {
  const childNodes = useMemo(() => nodes.filter(n => n.parentId), [nodes]);

  const connections = useMemo(() => {
    return childNodes.map(node => {
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;

      const palette = getBranchPalette(node.id, nodes);
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

      const d = `M ${sx} ${sy} C ${sx + cpX} ${sy}, ${ex - cpX} ${ey}, ${ex} ${ey}`;

      return {
        key: `conn-${parent.id}-${node.id}`,
        gradId: `conn-grad-${node.id}`,
        lineColor: palette.line,
        d,
        strokeW,
      };
    }).filter(Boolean) as {
      key: string;
      gradId: string;
      lineColor: string;
      d: string;
      strokeW: number;
    }[];
  }, [nodes, childNodes]);

  return (
    <g>
      <defs>
        {connections.map(c => (
          <linearGradient
            key={`grad-${c.key}`}
            id={c.gradId}
            x1="0%" y1="0%" x2="100%" y2="0%"
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

export const MindMapConnections = React.memo(MindMapConnectionsInner);
