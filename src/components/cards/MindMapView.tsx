import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  ChevronDown,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

interface MindMapViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  spaceName?: string;
  folderName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; lineColor: string }> = {
  backlog: { label: 'Backlog', color: 'bg-gray-400', lineColor: '#9ca3af' },
  briefing: { label: 'Briefing', color: 'bg-blue-500', lineColor: '#3b82f6' },
  todo: { label: 'A Fazer', color: 'bg-purple-500', lineColor: '#a855f7' },
  in_progress: { label: 'Em Progresso', color: 'bg-yellow-500', lineColor: '#eab308' },
  review: { label: 'Revisão', color: 'bg-orange-500', lineColor: '#f97316' },
  approved: { label: 'Aprovado', color: 'bg-green-500', lineColor: '#22c55e' },
  delivered: { label: 'Entregue', color: 'bg-emerald-600', lineColor: '#059669' },
  done: { label: 'Concluído', color: 'bg-green-600', lineColor: '#16a34a' },
};

interface MindMapNodeProps {
  card: Card;
  onClick: () => void;
  statusColor: string;
}

const MindMapNode: React.FC<MindMapNodeProps> = ({ card, onClick, statusColor }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all text-left min-w-[180px] max-w-[280px]"
    >
      <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", statusColor)} />
      <span className="text-sm font-medium truncate">{card.title}</span>
    </button>
  );
};

interface StatusBranchProps {
  status: string;
  cards: Card[];
  onCardClick: (card: Card) => void;
  isExpanded: boolean;
  onToggle: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}

const StatusBranch: React.FC<StatusBranchProps> = ({ 
  status, 
  cards, 
  onCardClick, 
  isExpanded, 
  onToggle,
  setRef,
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;

  return (
    <div ref={setRef} className="flex items-start gap-3">
      {/* Status node */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg shadow-sm hover:shadow-md transition-all min-w-[140px]"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className={cn("w-2.5 h-2.5 rounded-sm", config.color)} />
        <span className="text-sm font-medium">{config.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {cards.length}
        </Badge>
      </button>

      {/* Cards */}
      {isExpanded && cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <MindMapNode
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              statusColor={config.color}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MindMapView: React.FC<MindMapViewProps> = ({
  cards,
  onCardClick,
  spaceName = 'Espaço',
  folderName,
}) => {
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set(['in_progress', 'todo', 'review']));
  const rootRef = useRef<HTMLDivElement>(null);
  const branchRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group cards by status
  const cardsByStatus = useMemo(() => {
    const grouped: Record<string, Card[]> = {};
    
    cards.forEach(card => {
      const status = card.status || 'backlog';
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(card);
    });

    return grouped;
  }, [cards]);

  // Status order
  const statusOrder = ['backlog', 'briefing', 'todo', 'in_progress', 'review', 'approved', 'delivered', 'done'];
  const orderedStatuses = statusOrder.filter(s => cardsByStatus[s]?.length > 0);

  const toggleStatus = (status: string) => {
    setExpandedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const setBranchRef = useCallback((status: string) => (el: HTMLDivElement | null) => {
    if (el) {
      branchRefs.current.set(status, el);
    } else {
      branchRefs.current.delete(status);
    }
  }, []);

  // Draw connection lines
  useEffect(() => {
    const drawLines = () => {
      if (!svgRef.current || !rootRef.current || !containerRef.current) return;

      const svg = svgRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const rootRect = rootRef.current.getBoundingClientRect();

      // Clear existing paths
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }

      // Set SVG size
      svg.setAttribute('width', String(containerRect.width));
      svg.setAttribute('height', String(containerRect.height));

      // Draw lines to each branch
      orderedStatuses.forEach((status) => {
        const branchEl = branchRefs.current.get(status);
        if (!branchEl) return;

        const branchRect = branchEl.getBoundingClientRect();
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;

        // Calculate positions relative to container
        const startX = rootRect.right - containerRect.left;
        const startY = rootRect.top + rootRect.height / 2 - containerRect.top;
        const endX = branchRect.left - containerRect.left;
        const endY = branchRect.top + 20 - containerRect.top;

        // Create curved path
        const midX = startX + (endX - startX) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
        path.setAttribute('stroke', config.lineColor);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');

        svg.appendChild(path);
      });
    };

    // Initial draw
    const timer = setTimeout(drawLines, 100);

    // Redraw on resize
    const resizeObserver = new ResizeObserver(drawLines);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [orderedStatuses, expandedStatuses, cards]);

  if (cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum card para exibir</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div 
        ref={containerRef}
        className="relative p-8 min-w-[800px] min-h-[500px]"
      >
        {/* SVG for connection lines */}
        <svg
          ref={svgRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 0 }}
        />

        {/* Mind map content */}
        <div className="relative flex items-start gap-12" style={{ zIndex: 1 }}>
          {/* Root node */}
          <div 
            ref={rootRef}
            className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-xl shadow-lg min-w-[180px]"
          >
            <Folder className="h-5 w-5" />
            <span className="font-semibold">{folderName || spaceName}</span>
            <Badge variant="secondary" className="ml-auto bg-primary-foreground/20 text-primary-foreground">
              {cards.length}
            </Badge>
          </div>

          {/* Branches */}
          <div className="flex flex-col gap-3">
            {orderedStatuses.map((status) => (
              <StatusBranch
                key={status}
                status={status}
                cards={cardsByStatus[status] || []}
                onCardClick={onCardClick}
                isExpanded={expandedStatuses.has(status)}
                onToggle={() => toggleStatus(status)}
                setRef={setBranchRef(status)}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Status:</p>
          <div className="flex flex-wrap gap-3">
            {orderedStatuses.map((status) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-sm", config.color)} />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
