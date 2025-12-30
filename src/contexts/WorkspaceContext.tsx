import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { AppRole, SpaceType } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo_url: string | null;
  settings: Json;
}

interface WorkspaceMember {
  id: string;
  function_title: string | null;
  department: string | null;
  is_active: boolean;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentMember: WorkspaceMember | null;
  currentRole: AppRole | null;
  loading: boolean;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<{ error: Error | null; workspace?: Workspace }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentMember, setCurrentMember] = useState<WorkspaceMember | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentMember(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const workspaceIds = members.map(m => m.workspace_id);

      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .eq('status', 'active');

      if (workspacesError) throw workspacesError;

      setWorkspaces(workspacesData || []);

      if (!currentWorkspace && workspacesData && workspacesData.length > 0) {
        setCurrentWorkspace(workspacesData[0]);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!user || !currentWorkspace) {
        setCurrentMember(null);
        setCurrentRole(null);
        return;
      }

      try {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('id, function_title, department, is_active')
          .eq('user_id', user.id)
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle();

        setCurrentMember(memberData);

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle();

        setCurrentRole(roleData?.role as AppRole || null);
      } catch (error) {
        console.error('Error fetching member info:', error);
      }
    };

    fetchMemberInfo();
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const createWorkspace = async (name: string): Promise<{ error: Error | null; workspace?: Workspace }> => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50) + '-' + Date.now().toString(36);

      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({ name, slug })
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          function_title: 'Proprietário',
          is_active: true,
        });

      if (memberError) throw memberError;

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'owner',
        });

      if (roleError) throw roleError;

      const defaultSpaces: { name: string; type: SpaceType; icon: string; color: string }[] = [
        { name: 'Designer', type: 'designer', icon: 'palette', color: '#8b5cf6' },
        { name: 'Audiovisual', type: 'audiovisual', icon: 'video', color: '#ec4899' },
        { name: 'Social Media', type: 'social_media', icon: 'share-2', color: '#0ea5e9' },
        { name: 'Gestão de Tráfego', type: 'traffic', icon: 'target', color: '#f97316' },
        { name: 'Administrativo', type: 'administrative', icon: 'briefcase', color: '#64748b' },
        { name: 'Coordenação', type: 'coordination', icon: 'layout-dashboard', color: '#6366f1' },
      ];

      const { error: spacesError } = await supabase
        .from('spaces')
        .insert(
          defaultSpaces.map((space, index) => ({
            workspace_id: workspace.id,
            name: space.name,
            type: space.type,
            icon: space.icon,
            color: space.color,
            sort_order: index,
          }))
        );

      if (spacesError) console.error('Error creating default spaces:', spacesError);

      // Create default financial categories
      const defaultCategories: Array<{
        workspace_id: string;
        name: string;
        type: "expense" | "income" | "transfer";
        color: string;
        icon: string;
        is_system: boolean;
      }> = [
        { workspace_id: workspace.id, name: 'Salários', type: 'expense', color: '#ef4444', icon: 'users', is_system: true },
        { workspace_id: workspace.id, name: 'Fornecedores', type: 'expense', color: '#f97316', icon: 'truck', is_system: true },
        { workspace_id: workspace.id, name: 'Serviços', type: 'expense', color: '#eab308', icon: 'wrench', is_system: true },
        { workspace_id: workspace.id, name: 'Impostos', type: 'expense', color: '#84cc16', icon: 'landmark', is_system: true },
        { workspace_id: workspace.id, name: 'Marketing', type: 'expense', color: '#22c55e', icon: 'megaphone', is_system: true },
        { workspace_id: workspace.id, name: 'Infraestrutura', type: 'expense', color: '#14b8a6', icon: 'building', is_system: true },
        { workspace_id: workspace.id, name: 'Software', type: 'expense', color: '#06b6d4', icon: 'laptop', is_system: true },
        { workspace_id: workspace.id, name: 'Outros Gastos', type: 'expense', color: '#6b7280', icon: 'folder', is_system: true },
        { workspace_id: workspace.id, name: 'Clientes', type: 'income', color: '#10b981', icon: 'briefcase', is_system: true },
        { workspace_id: workspace.id, name: 'Projetos', type: 'income', color: '#0ea5e9', icon: 'folder-kanban', is_system: true },
        { workspace_id: workspace.id, name: 'Consultoria', type: 'income', color: '#8b5cf6', icon: 'lightbulb', is_system: true },
        { workspace_id: workspace.id, name: 'Outras Receitas', type: 'income', color: '#6b7280', icon: 'folder', is_system: true },
      ];

      const { error: categoriesError } = await supabase
        .from('financial_categories')
        .insert(defaultCategories);

      if (categoriesError) console.error('Error creating default categories:', categoriesError);

      await fetchWorkspaces();
      setCurrentWorkspace(workspace);

      return { error: null, workspace };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentMember,
        currentRole,
        loading,
        setCurrentWorkspace,
        refreshWorkspaces: fetchWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
