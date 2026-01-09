import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LevelsSettings } from '@/components/altcontrol/settings/LevelsSettings';
import { ServicesSettings } from '@/components/altcontrol/settings/ServicesSettings';
import { ApproversSettings } from '@/components/altcontrol/settings/ApproversSettings';
import { CostSettings } from '@/components/altcontrol/settings/CostSettings';

export const AltControlSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getActiveTab = () => {
    if (location.pathname.includes('services')) return 'services';
    if (location.pathname.includes('approvers')) return 'approvers';
    if (location.pathname.includes('costs')) return 'costs';
    return 'levels';
  };

  return (
    <div className="space-y-6">
      <Tabs value={getActiveTab()} onValueChange={(v) => navigate(`/altcontrol/settings/${v === 'levels' ? '' : v}`)}>
        <TabsList>
          <TabsTrigger value="levels">Níveis</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="approvers">Aprovadores</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="levels" className="mt-6">
          <LevelsSettings />
        </TabsContent>
        <TabsContent value="services" className="mt-6">
          <ServicesSettings />
        </TabsContent>
        <TabsContent value="approvers" className="mt-6">
          <ApproversSettings />
        </TabsContent>
        <TabsContent value="costs" className="mt-6">
          <CostSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};
