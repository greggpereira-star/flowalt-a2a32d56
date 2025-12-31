import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCorrelationId, getSessionId } from '@/lib/correlationId';

export type SocialMediaEventType =
  | 'social.folder.created'
  | 'social.folder.expanded'
  | 'social.folder.collapsed'
  | 'social.view.created'
  | 'social.view.opened'
  | 'social.card.created'
  | 'social.card.moved_status'
  | 'social.card.linked_to_folder'
  | 'social.cards.scope_resolved'
  | 'social.approval.action'
  | 'social.calendar.scheduled'
  | 'social.post.published'
  // RBAC events
  | 'rbac.folder.delete_attempt'
  | 'rbac.folder.delete_success'
  | 'rbac.folder.delete_denied'
  | 'rbac.view.delete_attempt'
  | 'rbac.view.delete_success'
  | 'rbac.view.delete_denied'
  | 'rbac.checklist.item.delete_attempt'
  | 'rbac.checklist.item.delete_success'
  | 'rbac.checklist.item.delete_denied';

interface BaseEventPayload {
  space_id?: string;
  folder_id?: string;
  view_id?: string;
  card_id?: string;
}

interface FolderCreatedPayload extends BaseEventPayload {
  template_used: 'empty' | 'kit';
  folder_name?: string;
}

interface ViewCreatedPayload extends BaseEventPayload {
  view_template: 'kanban' | 'calendar' | 'list' | 'ideas' | 'approvals' | 'campaigns' | 'reports';
  view_name?: string;
}

interface ViewOpenedPayload extends BaseEventPayload {
  view_type: string;
}

interface CardCreatedPayload extends BaseEventPayload {
  origin_view_type?: string;
}

interface CardMovedPayload extends BaseEventPayload {
  from: string;
  to: string;
  blocked: boolean;
  gate_reason?: string;
}

interface ApprovalActionPayload extends BaseEventPayload {
  action: 'approved' | 'changes_requested' | 'rejected';
  has_justification?: boolean;
}

interface CalendarScheduledPayload extends BaseEventPayload {
  has_post_date: boolean;
}

interface PostPublishedPayload extends BaseEventPayload {
  has_link: boolean;
}

interface CardLinkedToFolderPayload extends BaseEventPayload {
  success: boolean;
}

interface ScopeResolvedPayload extends BaseEventPayload {
  scope: 'folder' | 'space';
  count_cards: number;
}

interface RbacEventPayload extends BaseEventPayload {
  target_type: 'folder' | 'view' | 'checklist_item';
  target_id: string;
  result: 'attempt' | 'success' | 'denied';
  role?: string;
  reason?: string;
}

type EventPayload =
  | FolderCreatedPayload
  | ViewCreatedPayload
  | ViewOpenedPayload
  | CardCreatedPayload
  | CardMovedPayload
  | ApprovalActionPayload
  | CalendarScheduledPayload
  | PostPublishedPayload
  | CardLinkedToFolderPayload
  | ScopeResolvedPayload
  | RbacEventPayload
  | BaseEventPayload;

export function useSocialMediaTracking() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const trackEvent = useCallback(
    async (eventType: SocialMediaEventType, payload: EventPayload = {}) => {
      if (!currentWorkspace?.id || !user?.id) return;

      try {
        await supabase.from('domain_events').insert([{
          workspace_id: currentWorkspace.id,
          aggregate_id: payload.space_id || currentWorkspace.id,
          aggregate_type: 'social_media',
          event_type: eventType,
          payload: {
            ...payload,
            user_id: user.id,
            correlation_id: getCurrentCorrelationId(),
            session_id: getSessionId(),
            timestamp: new Date().toISOString(),
          },
        }]);
      } catch (error) {
        // Silent fail - don't interrupt user flow
        console.debug('Social media tracking error:', error);
      }
    },
    [currentWorkspace?.id, user?.id]
  );

  const trackFolderCreated = useCallback(
    (payload: FolderCreatedPayload) => {
      trackEvent('social.folder.created', payload);
    },
    [trackEvent]
  );

  const trackFolderExpanded = useCallback(
    (spaceId: string, folderId: string) => {
      trackEvent('social.folder.expanded', { space_id: spaceId, folder_id: folderId });
    },
    [trackEvent]
  );

  const trackFolderCollapsed = useCallback(
    (spaceId: string, folderId: string) => {
      trackEvent('social.folder.collapsed', { space_id: spaceId, folder_id: folderId });
    },
    [trackEvent]
  );

  const trackViewCreated = useCallback(
    (payload: ViewCreatedPayload) => {
      trackEvent('social.view.created', payload);
    },
    [trackEvent]
  );

  const trackViewOpened = useCallback(
    (payload: ViewOpenedPayload) => {
      trackEvent('social.view.opened', payload);
    },
    [trackEvent]
  );

  const trackCardCreated = useCallback(
    (payload: CardCreatedPayload) => {
      trackEvent('social.card.created', payload);
    },
    [trackEvent]
  );

  const trackCardMoved = useCallback(
    (payload: CardMovedPayload) => {
      trackEvent('social.card.moved_status', payload);
    },
    [trackEvent]
  );

  const trackApprovalAction = useCallback(
    (payload: ApprovalActionPayload) => {
      trackEvent('social.approval.action', payload);
    },
    [trackEvent]
  );

  const trackCalendarScheduled = useCallback(
    (payload: CalendarScheduledPayload) => {
      trackEvent('social.calendar.scheduled', payload);
    },
    [trackEvent]
  );

  const trackPostPublished = useCallback(
    (payload: PostPublishedPayload) => {
      trackEvent('social.post.published', payload);
    },
    [trackEvent]
  );

  const trackCardLinkedToFolder = useCallback(
    (payload: CardLinkedToFolderPayload) => {
      trackEvent('social.card.linked_to_folder', payload);
    },
    [trackEvent]
  );

  const trackScopeResolved = useCallback(
    (payload: ScopeResolvedPayload) => {
      trackEvent('social.cards.scope_resolved', payload);
    },
    [trackEvent]
  );

  // RBAC Tracking
  const trackRbacFolderDelete = useCallback(
    (folderId: string, result: 'attempt' | 'success' | 'denied', role?: string, reason?: string) => {
      const eventType = `rbac.folder.delete_${result}` as SocialMediaEventType;
      trackEvent(eventType, { folder_id: folderId, target_type: 'folder', target_id: folderId, result, role, reason });
    },
    [trackEvent]
  );

  const trackRbacViewDelete = useCallback(
    (viewId: string, folderId: string, result: 'attempt' | 'success' | 'denied', role?: string, reason?: string) => {
      const eventType = `rbac.view.delete_${result}` as SocialMediaEventType;
      trackEvent(eventType, { view_id: viewId, folder_id: folderId, target_type: 'view', target_id: viewId, result, role, reason });
    },
    [trackEvent]
  );

  const trackRbacChecklistDelete = useCallback(
    (itemId: string, folderId: string, result: 'attempt' | 'success' | 'denied', role?: string, reason?: string) => {
      const eventType = `rbac.checklist.item.delete_${result}` as SocialMediaEventType;
      trackEvent(eventType, { folder_id: folderId, target_type: 'checklist_item', target_id: itemId, result, role, reason });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackFolderCreated,
    trackFolderExpanded,
    trackFolderCollapsed,
    trackViewCreated,
    trackViewOpened,
    trackCardCreated,
    trackCardMoved,
    trackApprovalAction,
    trackCalendarScheduled,
    trackPostPublished,
    trackCardLinkedToFolder,
    trackScopeResolved,
    trackRbacFolderDelete,
    trackRbacViewDelete,
    trackRbacChecklistDelete,
  };
}
