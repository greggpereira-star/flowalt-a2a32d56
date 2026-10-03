import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarView } from '@/components/agenda/CalendarView';
import { UpcomingEvents } from '@/components/agenda/UpcomingEvents';
import { Calendar, List } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { cn } from '@/lib/utils';

const AgendaPage: React.FC = () => {
  usePageTracking('calendar');
  const { inicio: novo } = useNewUiBeta();
  
  return (
    <AppLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
          {/* Calendar Toolbar / Header */}
          <div className={cn('px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/50 backdrop-blur-md border-b shrink-0', novo && 'border-b-0 px-8 pb-2 pt-8')}>
            <div>
              <h1 className={cn('text-xl font-bold flex items-center gap-2', novo && 'text-[28px] font-extrabold leading-tight tracking-tight')}>
                <Calendar className={cn('h-5 w-5 text-primary', novo && 'hidden')} />
                Agenda
              </h1>
              <p className={cn('text-xs text-muted-foreground', novo && 'mt-1 text-sm')}>
                Eventos, reuniões e marcos do workspace
              </p>
            </div>

            <div className="flex items-center gap-3">
              <TabsList className={cn('bg-muted/50 p-1', novo && 'h-10 rounded-xl border border-border/60 bg-card shadow-sm')}>
                <TabsTrigger value="calendar" className="h-8 px-3 text-xs flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="list" className="h-8 px-3 text-xs flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <List className="h-3.5 w-3.5" />
                  Próximos
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="calendar" className="flex-1 min-h-0 m-0 p-0 overflow-auto">
            <div className={cn('p-4 md:p-6 h-full', novo && 'px-4 pb-8 pt-4 md:px-8')}>
              <CalendarView />
            </div>
          </TabsContent>

          <TabsContent value="list" className="flex-1 min-h-0 m-0 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
              <UpcomingEvents limit={20} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgendaPage;
