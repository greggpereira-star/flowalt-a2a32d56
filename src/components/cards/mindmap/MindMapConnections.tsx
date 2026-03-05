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

      const getVisualWidth = (target: MindMapNode, targetDepth: number) => {
        if (targetDepth === 0) return target.nodeWidth ?? 260; // root (centered)
        if (targetDepth === 1) return target.nodeWidth ?? 210; // branch card
        return (target.nodeWidth ?? 160) + 34; // leaf row (text block + dot/actions)
      };

      const palette = getBranchPalette(node.id, nodes);
      const depth = getNodeDepth(node.id, nodes);
      const parentDepth = getNodeDepth(parent.id, nodes);

      const strokeW = depth === 1 ? 2.5 : depth === 2 ? 1.8 : 1.2;

      const parentW = getVisualWidth(parent, parentDepth);
      const childW = getVisualWidth(node, depth);

      const parentLeft = parentDepth === 0 ? parent.x - parentW / 2 : parent.x;
      const parentRight = parentDepth === 0 ? parent.x + parentW / 2 : parent.x + parentW;
      const parentCenterX = (parentLeft + parentRight) / 2;

      const childLeft = depth === 0 ? node.x - childW / 2 : node.x;
      const childRight = depth === 0 ? node.x + childW / 2 : node.x + childW;
      const childCenterX = (childLeft + childRight) / 2;

      // Child on left branch => line exits parent's left edge and enters child's right edge
      const isLeft = childCenterX < parentCenterX;

      const sx = isLeft ? parentLeft : parentRight;
      const sy = parent.y;
      const ex = isLeft ? childRight : childLeft;
      const ey = node.y;

      const dx = Math.abs(ex - sx);
      const cpX = Math.max(dx * 0.42, 26);

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
            <stop offset="0%" stopColor={c.lineColor} stopOpacity={0.45} />
            <stop offset="40%" stopColor={c.lineColor} stopOpacity={0.7} />
            <stop offset="100%" stopColor={c.lineColor} stopOpacity={0.85} />
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
