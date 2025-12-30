import { supabase } from '@/integrations/supabase/client';
import { getCurrentCorrelationId, getSessionId } from './correlationId';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  context?: LogContext;
  workspaceId?: string;
}

class StructuredLogger {
  private service: string;
  private defaultContext: LogContext;

  constructor(service: string, defaultContext: LogContext = {}) {
    this.service = service;
    this.defaultContext = defaultContext;
  }

  private async log(entry: LogEntry): Promise<void> {
    const correlationId = getCurrentCorrelationId();
    const sessionId = getSessionId();

    const logData = {
      timestamp: new Date().toISOString(),
      level: entry.level,
      service: entry.service,
      message: entry.message,
      context: { ...this.defaultContext, ...entry.context },
      correlationId,
      sessionId,
      workspaceId: entry.workspaceId,
    };

    // Console output for development
    const consoleMethod = entry.level === 'error' || entry.level === 'fatal' 
      ? console.error 
      : entry.level === 'warn' 
        ? console.warn 
        : console.log;
    
    consoleMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, logData);

    // Persist to database (non-blocking)
    try {
      const contextData = JSON.parse(JSON.stringify({ ...this.defaultContext, ...entry.context }));
      await supabase.from('structured_logs').insert([{
        workspace_id: entry.workspaceId || null,
        log_level: entry.level,
        service: entry.service,
        message: entry.message,
        context: contextData,
        correlation_id: correlationId,
        session_id: sessionId,
      }]);
    } catch (error) {
      // Silently fail to prevent logging loops
      console.warn('Failed to persist log entry:', error);
    }
  }

  debug(message: string, context?: LogContext, workspaceId?: string): void {
    this.log({ level: 'debug', service: this.service, message, context, workspaceId });
  }

  info(message: string, context?: LogContext, workspaceId?: string): void {
    this.log({ level: 'info', service: this.service, message, context, workspaceId });
  }

  warn(message: string, context?: LogContext, workspaceId?: string): void {
    this.log({ level: 'warn', service: this.service, message, context, workspaceId });
  }

  error(message: string, context?: LogContext, workspaceId?: string): void {
    this.log({ level: 'error', service: this.service, message, context, workspaceId });
  }

  fatal(message: string, context?: LogContext, workspaceId?: string): void {
    this.log({ level: 'fatal', service: this.service, message, context, workspaceId });
  }

  child(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger(this.service, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }
}

// Factory function for creating loggers
export const createLogger = (service: string, context?: LogContext): StructuredLogger => {
  return new StructuredLogger(service, context);
};

// Default client logger
export const clientLogger = createLogger('client');

// Hook for component-level logging
export const useLogger = (component: string) => {
  return createLogger('client', { component });
};
