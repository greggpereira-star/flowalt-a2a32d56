import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarView } from '@/components/agenda/CalendarView';
import { UpcomingEvents } from '@/components/agenda/UpcomingEvents';
import { Calendar, List } from 'lucide-react';

const AgendaPage: React.FC = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie eventos, reuniões e compromissos
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <CalendarView />
          </TabsContent>

          <TabsContent value="list">
            <div className="grid md:grid-cols-2 gap-6">
              <UpcomingEvents limit={10} />
              {/* Could add more list views here */}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgendaPage;
