import { supabase } from '@/integrations/supabase/client';

// Tipos de notificação
export type EmailNotificationType =
  // Autenticação
  | 'email_confirmation'
  | 'password_reset'
  | 'password_changed'
  // Workspace
  | 'workspace_invite'
  | 'workspace_invite_accepted'
  | 'workspace_invite_expired'
  | 'workspace_invite_revoked'
  // Cards
  | 'card_invite'
  | 'card_invite_accepted'
  | 'card_member_removed'
  // Governança
  | 'role_changed'
  | 'ownership_transferred'
  // Sistema
  | 'overdue_card'
  | 'webhook_failure'
  | 'goal_completed'
  | 'level_up'
  | 'custom';

// Labels para roles
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  coordinator: 'Coordenador',
  finance: 'Financeiro',
  member: 'Membro',
  viewer: 'Visualizador',
};

// Labels para permissões de card
export const PERMISSION_LABELS: Record<string, string> = {
  view: 'Visualização',
  comment: 'Comentários',
  edit: 'Edição',
};

interface SendEmailParams {
  type: EmailNotificationType;
  workspace_id?: string;
  user_id?: string;
  email?: string;
  subject?: string;
  data: Record<string, any>;
  skip_preference_check?: boolean;
}

/**
 * Envia uma notificação por email
 */
export async function sendEmailNotification(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email-notification', {
      body: params,
    });

    if (error) {
      console.error('Error sending email notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('Error invoking email function:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Busca informações do perfil do usuário
 */
export async function fetchUserProfile(userId: string): Promise<{ name?: string; email?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      name: data.full_name || undefined,
      email: data.email || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Busca informações do workspace
 */
export async function fetchWorkspaceInfo(workspaceId: string): Promise<{ name?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (error || !data) return null;

    return { name: data.name };
  } catch {
    return null;
  }
}

/**
 * Helper para enviar notificação de convite de workspace
 */
export async function sendWorkspaceInviteEmail(params: {
  email: string;
  workspace_id: string;
  workspace_name: string;
  inviter_name?: string;
  inviter_email?: string;
  role: string;
  token: string;
  expires_in?: string;
}) {
  const inviteUrl = `${window.location.origin}/invite/${params.token}`;

  return sendEmailNotification({
    type: 'workspace_invite',
    workspace_id: params.workspace_id,
    email: params.email,
    data: {
      workspace_name: params.workspace_name,
      inviter_name: params.inviter_name || 'Administrador',
      role: params.role,
      role_label: ROLE_LABELS[params.role] || params.role,
      invite_url: inviteUrl,
      expires_in: params.expires_in || '7 dias',
      ...(params.inviter_email ? { reply_to: params.inviter_email } : {}),
    },
  });
}

/**
 * Helper para enviar notificação de convite aceito (para o admin)
 */
export async function sendWorkspaceInviteAcceptedEmail(params: {
  admin_user_id: string;
  workspace_id: string;
  workspace_name: string;
  new_member_name: string;
  new_member_email: string;
  role: string;
}) {
  const teamUrl = `${window.location.origin}/settings?tab=members`;

  return sendEmailNotification({
    type: 'workspace_invite_accepted',
    workspace_id: params.workspace_id,
    user_id: params.admin_user_id,
    data: {
      workspace_name: params.workspace_name,
      user_name: params.new_member_name,
      user_email: params.new_member_email,
      role: params.role,
      role_label: ROLE_LABELS[params.role] || params.role,
      team_url: teamUrl,
    },
  });
}

/**
 * Helper para enviar notificação de convite de card
 */
export async function sendCardInviteEmail(params: {
  email: string;
  workspace_id: string;
  card_id: string;
  card_title: string;
  permission: string;
  inviter_name?: string;
}) {
  const cardUrl = `${window.location.origin}/tasks?card=${params.card_id}`;

  return sendEmailNotification({
    type: 'card_invite',
    workspace_id: params.workspace_id,
    email: params.email,
    data: {
      card_title: params.card_title,
      permission: params.permission,
      permission_label: PERMISSION_LABELS[params.permission] || params.permission,
      inviter_name: params.inviter_name,
      card_url: cardUrl,
    },
  });
}

/**
 * Helper para enviar notificação de alteração de função
 */
export async function sendRoleChangedEmail(params: {
  user_id: string;
  workspace_id: string;
  workspace_name: string;
  old_role: string;
  new_role: string;
}) {
  const workspaceUrl = `${window.location.origin}/`;

  return sendEmailNotification({
    type: 'role_changed',
    workspace_id: params.workspace_id,
    user_id: params.user_id,
    data: {
      workspace_name: params.workspace_name,
      old_role: params.old_role,
      old_role_label: ROLE_LABELS[params.old_role] || params.old_role,
      new_role: params.new_role,
      new_role_label: ROLE_LABELS[params.new_role] || params.new_role,
      workspace_url: workspaceUrl,
    },
  });
}

/**
 * Helper para enviar notificação de transferência de propriedade
 */
export async function sendOwnershipTransferredEmail(params: {
  new_owner_id: string;
  workspace_id: string;
  workspace_name: string;
}) {
  const workspaceUrl = `${window.location.origin}/`;

  return sendEmailNotification({
    type: 'ownership_transferred',
    workspace_id: params.workspace_id,
    user_id: params.new_owner_id,
    data: {
      workspace_name: params.workspace_name,
      workspace_url: workspaceUrl,
    },
  });
}
