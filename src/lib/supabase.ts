import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Types para RBAC - Updated with 'finance' role per blueprint
export type AppRole = 'super_admin' | 'owner' | 'admin' | 'coordinator' | 'finance' | 'member' | 'viewer';
export type WorkspaceStatus = 'active' | 'trial' | 'suspended' | 'inactive';
export type CardStatus = 'backlog' | 'briefing' | 'todo' | 'in_progress' | 'review' | 'approved' | 'delivered' | 'archived';
export type CardUrgency = 'low' | 'medium' | 'high' | 'critical';
export type SpaceType = 'designer' | 'audiovisual' | 'social_media' | 'traffic' | 'administrative' | 'coordination' | 'custom';
export type SpaceAccessLevel = 'operational' | 'restricted';
export type CardVisibility = 'inherit' | 'restricted' | 'public';

// Helper para verificar roles
export const hasMinimumRole = (userRole: AppRole, requiredRole: AppRole): boolean => {
  const roleHierarchy: AppRole[] = ['viewer', 'member', 'coordinator', 'admin', 'owner', 'super_admin'];
  const userRoleIndex = roleHierarchy.indexOf(userRole);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
  return userRoleIndex >= requiredRoleIndex;
};

// Helper para criar slug do workspace
export const createWorkspaceSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
};
