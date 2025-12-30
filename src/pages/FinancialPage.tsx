import { Helmet } from "react-helmet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "@/components/financial/TransactionList";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { FinancialDashboard } from "@/components/financial/FinancialDashboard";
import { CollaboratorManager } from "@/components/financial/CollaboratorManager";
import {
  LayoutDashboard,
  List,
  Users,
  DollarSign,
} from "lucide-react";
import { usePageTracking } from '@/hooks/usePageTracking';

export default function FinancialPage() {
  usePageTracking('financial');
  
  return (
    <>
      <Helmet>
        <title>Financeiro | FlowAgency</title>
        <meta name="description" content="Gestão financeira completa com lançamentos, fluxo de caixa e controle de colaboradores" />
      </Helmet>

      <AppLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financeiro</h1>
              <p className="text-muted-foreground">
                Gestão financeira e controle de colaboradores
              </p>
            </div>
            <TransactionForm />
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <List className="w-4 h-4" />
                Lançamentos
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Fluxo de Caixa
              </TabsTrigger>
              <TabsTrigger value="collaborators" className="gap-2">
                <Users className="w-4 h-4" />
                Colaboradores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <FinancialDashboard />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionList />
            </TabsContent>

            <TabsContent value="cashflow">
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-green-500">Receitas</h3>
                    <TransactionList filters={{ type: "income" }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-red-500">Despesas</h3>
                    <TransactionList filters={{ type: "expense" }} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="collaborators">
              <CollaboratorManager />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </>
  );
}
