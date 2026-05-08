import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { generateId } from '@/lib/utils';
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
  createWorkspace: (name: string, metadata?: WorkspaceMetadata) => Promise<{ error: Error | null; workspace?: Workspace }>;
}

export interface WorkspaceMetadata {
  company_size?: string;
  objectives?: string[];
  segment?: string | null;
  country?: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentMember, setCurrentMember] = useState<WorkspaceMember | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchWorkspaces = async () => {
    // Keep provider in loading state while auth is still resolving.
    // This prevents false redirects to onboarding during the login transition.
    if (authLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);

    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentMember(null);
      setCurrentRole(null);
      setLoading(false);
      setRoleLoading(false);
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
        setRoleLoading(false);
        return;
      }

      const workspaceIds = members.map((m) => m.workspace_id);

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

  // Fetch member info and role - track loading state separately
  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!user || !currentWorkspace) {
        setCurrentMember(null);
        setCurrentRole(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

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
      } finally {
        setRoleLoading(false);
      }
    };

    fetchMemberInfo();
  }, [user, currentWorkspace]);

  useEffect(() => {
    // Wait for auth to finish; otherwise we can briefly think the user has 0 workspaces.
    if (authLoading) {
      setLoading(true);
      return;
    }

    fetchWorkspaces();
  }, [user, authLoading]);

  // Combined loading: both workspace and role must be loaded
  const isFullyLoaded = !loading && !roleLoading;

  const createWorkspace = async (name: string, metadata?: WorkspaceMetadata): Promise<{ error: Error | null; workspace?: Workspace }> => {
    if (!user) return { error: new Error('User not authenticated') };

    const workspaceId = generateUuid();
    let memberCreated = false;
    let roleCreated = false;

    try {
      const slug =
        name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50) + '-' + Date.now().toString(36);

      // Incluir metadata nas settings do workspace
      const workspaceSettings = metadata ? {
        company_size: metadata.company_size,
        objectives: metadata.objectives,
        segment: metadata.segment,
        country: metadata.country,
      } : {};

      const { error: workspaceError } = await supabase
        .from('workspaces')
        .insert({ 
          id: workspaceId, 
          name, 
          slug,
          settings: workspaceSettings as Json,
        });

      if (workspaceError) {
        console.error('Error creating workspace:', workspaceError);
        throw new Error(`Erro ao criar workspace: ${workspaceError.message}`);
      }

      // CRITICAL: Member insert must succeed for the workspace to be usable
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          function_title: 'Proprietário',
          is_active: true,
          can_view_financials: true,
        });

      if (memberError) {
        console.error('Error creating workspace member:', memberError);
        // Rollback: delete the workspace since member creation failed
        await supabase.from('workspaces').delete().eq('id', workspaceId);
        throw new Error(`Erro ao associar usuário ao workspace: ${memberError.message}`);
      }
      memberCreated = true;

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          role: 'owner',
        });

      if (roleError) {
        console.error('Error creating user role:', roleError);
        // Rollback: delete member and workspace
        await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', user.id);
        await supabase.from('workspaces').delete().eq('id', workspaceId);
        throw new Error(`Erro ao criar permissões: ${roleError.message}`);
      }
      roleCreated = true;

      // Create default financial categories (non-critical, just log errors)
      const defaultCategories: Array<{
        workspace_id: string;
        name: string;
        type: 'expense' | 'income' | 'transfer';
        color: string;
        icon: string;
        is_system: boolean;
      }> = [
        { workspace_id: workspaceId, name: 'Salários', type: 'expense', color: '#ef4444', icon: 'users', is_system: true },
        { workspace_id: workspaceId, name: 'Fornecedores', type: 'expense', color: '#f97316', icon: 'truck', is_system: true },
        { workspace_id: workspaceId, name: 'Serviços', type: 'expense', color: '#eab308', icon: 'wrench', is_system: true },
        { workspace_id: workspaceId, name: 'Impostos', type: 'expense', color: '#84cc16', icon: 'landmark', is_system: true },
        { workspace_id: workspaceId, name: 'Marketing', type: 'expense', color: '#22c55e', icon: 'megaphone', is_system: true },
        { workspace_id: workspaceId, name: 'Infraestrutura', type: 'expense', color: '#14b8a6', icon: 'building', is_system: true },
        { workspace_id: workspaceId, name: 'Software', type: 'expense', color: '#06b6d4', icon: 'laptop', is_system: true },
        { workspace_id: workspaceId, name: 'Outros Gastos', type: 'expense', color: '#6b7280', icon: 'folder', is_system: true },
        { workspace_id: workspaceId, name: 'Clientes', type: 'income', color: '#10b981', icon: 'briefcase', is_system: true },
        { workspace_id: workspaceId, name: 'Projetos', type: 'income', color: '#0ea5e9', icon: 'folder-kanban', is_system: true },
        { workspace_id: workspaceId, name: 'Consultoria', type: 'income', color: '#8b5cf6', icon: 'lightbulb', is_system: true },
        { workspace_id: workspaceId, name: 'Outras Receitas', type: 'income', color: '#6b7280', icon: 'folder', is_system: true },
      ];

      const { error: categoriesError } = await supabase.from('financial_categories').insert(defaultCategories);
      if (categoriesError) console.error('Error creating default categories:', categoriesError);

      // Now that membership exists, reading the workspace row is allowed by policy.
      const { data: createdWorkspace, error: createdWorkspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (createdWorkspaceError) {
        console.error('Error fetching created workspace:', createdWorkspaceError);
      }

      const fallbackWorkspace: Workspace = {
        id: workspaceId,
        name,
        slug,
        status: 'active',
        logo_url: null,
        settings: {} as Json,
      };

      // Refresh workspaces list and set as current
      await fetchWorkspaces();
      setCurrentWorkspace(createdWorkspace ?? fallbackWorkspace);

      return { error: null, workspace: createdWorkspace ?? fallbackWorkspace };
    } catch (error) {
      // If we partially created resources, try to clean up
      if (!memberCreated || !roleCreated) {
        try {
          await supabase.from('user_roles').delete().eq('workspace_id', workspaceId).eq('user_id', user.id);
          await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', user.id);
          await supabase.from('workspaces').delete().eq('id', workspaceId);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      }
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
        loading: !isFullyLoaded, // Only report as not loading when both workspace AND role are loaded
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
