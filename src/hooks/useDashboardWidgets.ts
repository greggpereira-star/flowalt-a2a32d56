import { useState, useEffect } from 'react';

export type WidgetId = 
  | 'work-radar'
  | 'pending-tasks'
  | 'active-timer'
  | 'today-deadlines'
  | 'today-events'
  | 'quick-tasks'
  | 'recent-activity';

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  description: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'work-radar', label: 'Work Radar', description: 'Visão rápida do trabalho', enabled: true, order: 0 },
  { id: 'pending-tasks', label: 'Tarefas Pendentes', description: 'Cards aguardando ação', enabled: true, order: 1 },
  { id: 'active-timer', label: 'Timer Ativo', description: 'Cronômetro em execução', enabled: true, order: 2 },
  { id: 'today-deadlines', label: 'Prazos de Hoje', description: 'Cards com vencimento hoje', enabled: true, order: 3 },
  { id: 'today-events', label: 'Eventos de Hoje', description: 'Reuniões e compromissos', enabled: true, order: 4 },
  { id: 'quick-tasks', label: 'Acesso Rápido', description: 'Minhas tarefas', enabled: true, order: 5 },
  { id: 'recent-activity', label: 'Atividade Recente', description: 'Últimas atualizações', enabled: true, order: 6 },
];

const STORAGE_KEY = 'flowalt_dashboard_widgets';

export const useDashboardWidgets = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDGETS;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WidgetConfig[];
        // Merge with defaults to handle new widgets
        return DEFAULT_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.find(w => w.id === defaultWidget.id);
          return savedWidget 
            ? { ...defaultWidget, enabled: savedWidget.enabled, order: savedWidget.order }
            : defaultWidget;
        }).sort((a, b) => a.order - b.order);
      } catch {
        return DEFAULT_WIDGETS;
      }
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidget = (widgetId: WidgetId) => {
    setWidgets(prev => 
      prev.map(w => 
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w
      )
    );
  };

  const reorderWidgets = (startIndex: number, endIndex: number) => {
    setWidgets(prev => {
      const result = [...prev];
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((w, i) => ({ ...w, order: i }));
    });
  };

  const resetToDefaults = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isWidgetEnabled = (widgetId: WidgetId) => {
    return widgets.find(w => w.id === widgetId)?.enabled ?? true;
  };

  const enabledWidgets = widgets.filter(w => w.enabled);

  return {
    widgets,
    enabledWidgets,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    isWidgetEnabled,
  };
};
