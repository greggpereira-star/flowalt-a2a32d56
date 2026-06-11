import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarView } from '@/components/agenda/CalendarView';
import { UpcomingEvents } from '@/components/agenda/UpcomingEvents';
import { Calendar, List } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

const AgendaPage: React.FC = () => {
  usePageTracking('calendar');
  
  return (
    <AppLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
          {/* Calendar Toolbar / Header */}
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/50 backdrop-blur-md border-b shrink-0">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Agenda
              </h1>
              <p className="text-xs text-muted-foreground">
                Eventos, reuniões e marcos do workspace
              </p>
            </div>

            <div className="flex items-center gap-3">
              <TabsList className="bg-muted/50 p-1">
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
            <div className="p-4 md:p-6 h-full">
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
