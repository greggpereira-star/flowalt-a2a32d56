import React, { useMemo } from 'react';
import { MindMapNode } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface NodeConnectionBounds {
  left: number;
  right: number;
  y: number;
}

interface Props {
  nodes: MindMapNode[];
  nodeBounds?: Record<string, NodeConnectionBounds>;
}

export const MindMapConnections: React.FC<Props> = ({ nodes, nodeBounds = {} }) => {
  const connections = useMemo(() => {
    return nodes
      .filter((n) => n.parentId)
      .map((node) => {
        const parent = nodes.find((n) => n.id === node.parentId);
        if (!parent) return null;

        const getFallbackVisualWidth = (target: MindMapNode, targetDepth: number) => {
          if (targetDepth === 0) return target.nodeWidth ?? 260;
          if (targetDepth === 1) return target.nodeWidth ?? 210;
          return (target.nodeWidth ?? 160) + 34;
        };

        const palette = getBranchPalette(node.id, nodes);
        const depth = getNodeDepth(node.id, nodes);
        const parentDepth = getNodeDepth(parent.id, nodes);

        const strokeW = depth === 1 ? 2.5 : depth === 2 ? 1.8 : 1.2;

        const parentFallbackW = getFallbackVisualWidth(parent, parentDepth);
        const childFallbackW = getFallbackVisualWidth(node, depth);

        const parentFallbackLeft = parentDepth === 0 ? parent.x - parentFallbackW / 2 : parent.x;
        const parentFallbackRight = parentDepth === 0 ? parent.x + parentFallbackW / 2 : parent.x + parentFallbackW;
        const childFallbackLeft = depth === 0 ? node.x - childFallbackW / 2 : node.x;
        const childFallbackRight = depth === 0 ? node.x + childFallbackW / 2 : node.x + childFallbackW;

        const parentBounds = nodeBounds[parent.id];
        const childBounds = nodeBounds[node.id];

        const parentLeft = parentBounds?.left ?? parentFallbackLeft;
        const parentRight = parentBounds?.right ?? parentFallbackRight;
        const childLeft = childBounds?.left ?? childFallbackLeft;
        const childRight = childBounds?.right ?? childFallbackRight;

        const parentCenterX = (parentLeft + parentRight) / 2;
        const childCenterX = (childLeft + childRight) / 2;

        const isLeft = childCenterX < parentCenterX;

        const sx = isLeft ? parentLeft : parentRight;
        const sy = parentBounds?.y ?? parent.y;
        const ex = isLeft ? childRight : childLeft;
        const ey = childBounds?.y ?? node.y;

        const dx = Math.abs(ex - sx);
        const cpX = Math.max(dx * 0.42, 26);

        const d = isLeft
          ? `M ${sx} ${sy} C ${sx - cpX} ${sy}, ${ex + cpX} ${ey}, ${ex} ${ey}`
          : `M ${sx} ${sy} C ${sx + cpX} ${sy}, ${ex - cpX} ${ey}, ${ex} ${ey}`;

        return {
          key: `conn-${parent.id}-${node.id}`,
          lineColor: palette.line,
          d,
          strokeW,
        };
      })
      .filter(Boolean) as {
      key: string;
      lineColor: string;
      d: string;
      strokeW: number;
    }[];
  }, [nodes, nodeBounds]);

  return (
    <g>
      {connections.map((c) => (
        <path
          key={c.key}
          d={c.d}
          stroke={c.lineColor}
          strokeWidth={c.strokeW}
          fill="none"
          strokeLinecap="round"
          strokeOpacity={1}
        />
      ))}
    </g>
  );
};
