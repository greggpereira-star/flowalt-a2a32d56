import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// =====================================================
// AUTOMATION ENGINE - EDA-based Execution
// =====================================================

export interface AutomationContext {
  cardId: string;
  cardTitle: string;
  previousStage: string | null;
  currentStage: string;
  triggeredBy: string;
  workspaceId: string;
}

export interface AutomationAction {
  id: string;
  name: string;
  action_type: string;
  action_config: Json;
}

export interface AutomationResult {
  automationId: string;
  success: boolean;
  action_type: string;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Execute automations when a card enters a new stage
 * This is the main entry point for the automation engine
 */
export async function executeStageAutomations(
  context: AutomationContext
): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];

  try {
    // Fetch active automations for this trigger stage
    const { data: automations, error: fetchError } = await supabase
      .from('card_automations')
      .select('id, name, action_type, action_config')
      .eq('workspace_id', context.workspaceId)
      .eq('trigger_status', context.currentStage)
      .eq('is_active', true);

    if (fetchError) {
      console.error('[AutomationEngine] Failed to fetch automations:', fetchError);
      return results;
    }

    if (!automations || automations.length === 0) {
      console.log('[AutomationEngine] No automations for stage:', context.currentStage);
      return results;
    }

    console.log(`[AutomationEngine] Found ${automations.length} automations for stage: ${context.currentStage}`);

    // Execute each automation
    for (const automation of automations) {
      const result = await executeAutomation(automation, context);
      results.push(result);

      // Log the execution
      await logAutomationExecution({
        automationId: automation.id,
        cardId: context.cardId,
        triggerStatus: context.currentStage,
        actionType: automation.action_type,
        success: result.success,
        result: result.result,
        error: result.error,
      });
    }

    return results;
  } catch (error) {
    console.error('[AutomationEngine] Unexpected error:', error);
    return results;
  }
}

/**
 * Execute a single automation action
 */
async function executeAutomation(
  automation: AutomationAction,
  context: AutomationContext
): Promise<AutomationResult> {
  console.log(`[AutomationEngine] Executing: ${automation.name} (${automation.action_type})`);

  try {
    const config = automation.action_config as Record<string, string>;

    switch (automation.action_type) {
      case 'change_status':
        return await executeChangeStatus(automation, context, config);
      
      case 'set_urgency':
        return await executeSetUrgency(automation, context, config);
      
      case 'add_comment':
        return await executeAddComment(automation, context, config);
      
      case 'send_notification':
        return await executeSendNotification(automation, context, config);
      
      case 'assign_owner':
        return await executeAssignOwner(automation, context, config);
      
      case 'create_checklist':
        return await executeCreateChecklist(automation, context, config);
      
      default:
        return {
          automationId: automation.id,
          success: false,
          action_type: automation.action_type,
          error: `Unknown action type: ${automation.action_type}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AutomationEngine] Error executing ${automation.name}:`, error);
    
    return {
      automationId: automation.id,
      success: false,
      action_type: automation.action_type,
      error: errorMessage,
    };
  }
}

/**
 * Change card status/stage
 */
async function executeChangeStatus(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const targetStatus = config.target_status;
  
  if (!targetStatus) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'change_status',
      error: 'No target status configured',
    };
  }

  const { error } = await supabase
    .from('cards')
    .update({ 
      current_stage: targetStatus,
      stage_entered_at: new Date().toISOString(),
    })
    .eq('id', context.cardId);

  if (error) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'change_status',
      error: error.message,
    };
  }

  // Emit event for the auto-transition
  await supabase.from('workflow_events').insert({
    workspace_id: context.workspaceId,
    event_type: 'card.auto_transitioned',
    entity_type: 'card',
    entity_id: context.cardId,
    payload: {
      from_stage: context.currentStage,
      to_stage: targetStatus,
      automation_id: automation.id,
      automation_name: automation.name,
    },
    triggered_by: context.triggeredBy,
  });

  return {
    automationId: automation.id,
    success: true,
    action_type: 'change_status',
    result: { target_status: targetStatus },
  };
}

/**
 * Set card urgency
 */
async function executeSetUrgency(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const targetUrgency = config.target_urgency as 'low' | 'medium' | 'high' | 'critical';
  
  if (!targetUrgency) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'set_urgency',
      error: 'No target urgency configured',
    };
  }

  const { error } = await supabase
    .from('cards')
    .update({ urgency: targetUrgency })
    .eq('id', context.cardId);

  if (error) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'set_urgency',
      error: error.message,
    };
  }

  return {
    automationId: automation.id,
    success: true,
    action_type: 'set_urgency',
    result: { target_urgency: targetUrgency },
  };
}

/**
 * Add automatic comment
 */
async function executeAddComment(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const commentText = config.comment_text;
  
  if (!commentText) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'add_comment',
      error: 'No comment text configured',
    };
  }

  // Replace placeholders
  const processedComment = commentText
    .replace('{card_title}', context.cardTitle)
    .replace('{stage}', context.currentStage)
    .replace('{previous_stage}', context.previousStage || 'N/A');

  const { error } = await supabase
    .from('comments')
    .insert({
      card_id: context.cardId,
      user_id: context.triggeredBy,
      content: `🤖 [Automação] ${processedComment}`,
    });

  if (error) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'add_comment',
      error: error.message,
    };
  }

  return {
    automationId: automation.id,
    success: true,
    action_type: 'add_comment',
    result: { comment: processedComment },
  };
}

/**
 * Send notification to card members
 */
async function executeSendNotification(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const { notification_title, notification_message } = config;
  
  if (!notification_title || !notification_message) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'send_notification',
      error: 'Missing notification title or message',
    };
  }

  // Get card members
  const { data: cardMembers } = await supabase
    .from('card_members')
    .select('user_id')
    .eq('card_id', context.cardId);

  // Get card owner
  const { data: card } = await supabase
    .from('cards')
    .select('owner_id')
    .eq('id', context.cardId)
    .single();

  const userIds = new Set<string>();
  if (card?.owner_id) userIds.add(card.owner_id);
  cardMembers?.forEach(m => userIds.add(m.user_id));

  // Create notifications for each user
  const notifications = Array.from(userIds).map(userId => ({
    workspace_id: context.workspaceId,
    user_id: userId,
    title: notification_title.replace('{card_title}', context.cardTitle),
    message: notification_message.replace('{card_title}', context.cardTitle),
    type: 'automation',
    entity_type: 'card',
    entity_id: context.cardId,
    is_read: false,
  }));

  if (notifications.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      return {
        automationId: automation.id,
        success: false,
        action_type: 'send_notification',
        error: error.message,
      };
    }
  }

  return {
    automationId: automation.id,
    success: true,
    action_type: 'send_notification',
    result: { notified_users: userIds.size },
  };
}

/**
 * Assign owner automatically
 */
async function executeAssignOwner(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const targetUserId = config.target_user_id;
  
  if (!targetUserId) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'assign_owner',
      error: 'No target user configured',
    };
  }

  const { error } = await supabase
    .from('cards')
    .update({ owner_id: targetUserId })
    .eq('id', context.cardId);

  if (error) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'assign_owner',
      error: error.message,
    };
  }

  return {
    automationId: automation.id,
    success: true,
    action_type: 'assign_owner',
    result: { assigned_to: targetUserId },
  };
}

/**
 * Create checklist items
 */
async function executeCreateChecklist(
  automation: AutomationAction,
  context: AutomationContext,
  config: Record<string, string>
): Promise<AutomationResult> {
  const checklistItems = config.checklist_items;
  
  if (!checklistItems) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'create_checklist',
      error: 'No checklist items configured',
    };
  }

  const items = checklistItems.split('\n').filter(item => item.trim());
  
  const { error } = await supabase
    .from('checklists')
    .insert(
      items.map((title, index) => ({
        card_id: context.cardId,
        title: title.trim(),
        sort_order: index,
        is_completed: false,
      }))
    );

  if (error) {
    return {
      automationId: automation.id,
      success: false,
      action_type: 'create_checklist',
      error: error.message,
    };
  }

  return {
    automationId: automation.id,
    success: true,
    action_type: 'create_checklist',
    result: { items_created: items.length },
  };
}

/**
 * Log automation execution to database
 */
async function logAutomationExecution(params: {
  automationId: string;
  cardId: string;
  triggerStatus: string;
  actionType: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  try {
    await supabase.from('automation_logs').insert([{
      automation_id: params.automationId,
      card_id: params.cardId,
      trigger_status: params.triggerStatus,
      action_type: params.actionType,
      success: params.success,
      action_result: (params.result || null) as Json,
      error_message: params.error || null,
    }]);
  } catch (error) {
    console.error('[AutomationEngine] Failed to log execution:', error);
  }
}
