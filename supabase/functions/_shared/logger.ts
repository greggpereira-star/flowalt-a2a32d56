/**
 * Structured Logger for Edge Functions
 * Provides consistent logging format with correlation IDs and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  correlationId?: string;
  workspaceId?: string;
  userId?: string;
  context?: LogContext;
  duration_ms?: number;
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return `${timestamp}-${random}`;
}

/**
 * Extract or generate correlation ID from request headers
 */
export function getCorrelationIdFromRequest(req: Request): string {
  return req.headers.get('x-correlation-id') || 
         req.headers.get('x-request-id') || 
         generateCorrelationId();
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  service: string,
  message: string,
  context?: LogContext,
  options?: {
    correlationId?: string;
    workspaceId?: string;
    userId?: string;
    duration_ms?: number;
  }
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    correlationId: options?.correlationId,
    workspaceId: options?.workspaceId,
    userId: options?.userId,
    context,
    duration_ms: options?.duration_ms,
  };
}

/**
 * Log to console with structured format
 */
function logToConsole(entry: LogEntry): void {
  const logString = JSON.stringify(entry);
  
  switch (entry.level) {
    case 'error':
    case 'fatal':
      console.error(logString);
      break;
    case 'warn':
      console.warn(logString);
      break;
    default:
      console.log(logString);
  }
}

/**
 * Log to database (async, non-blocking)
 */
async function logToDatabase(
  supabase: any,
  entry: LogEntry
): Promise<void> {
  try {
    await supabase.from('structured_logs').insert([{
      workspace_id: entry.workspaceId || null,
      log_level: entry.level,
      service: entry.service,
      message: entry.message,
      context: {
        ...entry.context,
        duration_ms: entry.duration_ms,
        userId: entry.userId,
      },
      correlation_id: entry.correlationId || null,
    }]);
  } catch (error) {
    // Silently fail to prevent logging loops
    console.warn('Failed to persist log to database:', error);
  }
}

/**
 * Edge Function Logger Class
 */
export class EdgeLogger {
  private service: string;
  private correlationId: string;
  private workspaceId?: string;
  private userId?: string;
  private supabase?: any;
  private startTime: number;

  constructor(
    service: string,
    options?: {
      correlationId?: string;
      workspaceId?: string;
      userId?: string;
      supabase?: any;
    }
  ) {
    this.service = service;
    this.correlationId = options?.correlationId || generateCorrelationId();
    this.workspaceId = options?.workspaceId;
    this.userId = options?.userId;
    this.supabase = options?.supabase;
    this.startTime = Date.now();
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = createLogEntry(level, this.service, message, context, {
      correlationId: this.correlationId,
      workspaceId: this.workspaceId,
      userId: this.userId,
    });

    logToConsole(entry);

    // Persist errors and warnings to database
    if (this.supabase && (level === 'error' || level === 'warn' || level === 'fatal')) {
      logToDatabase(this.supabase, entry);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }

  /**
   * Log the end of a request with duration
   */
  logRequestEnd(status: number, context?: LogContext): void {
    const duration = Date.now() - this.startTime;
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    const entry = createLogEntry(level, this.service, 'Request completed', {
      status,
      ...context,
    }, {
      correlationId: this.correlationId,
      workspaceId: this.workspaceId,
      userId: this.userId,
      duration_ms: duration,
    });

    logToConsole(entry);

    if (this.supabase) {
      // Record metric for request duration
      this.supabase.rpc('record_metric', {
        p_metric_type: 'api',
        p_metric_name: `${this.service}_request_duration_ms`,
        p_metric_value: duration,
        p_workspace_id: this.workspaceId || null,
        p_dimensions: { status, correlationId: this.correlationId },
        p_correlation_id: this.correlationId,
      }).catch(() => {}); // Non-blocking
    }
  }

  /**
   * Set workspace ID after initialization
   */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId;
  }

  /**
   * Set user ID after authentication
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Get correlation ID for response headers
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalService?: string): EdgeLogger {
    return new EdgeLogger(additionalService || this.service, {
      correlationId: this.correlationId,
      workspaceId: this.workspaceId,
      userId: this.userId,
      supabase: this.supabase,
    });
  }
}

/**
 * Create CORS headers with correlation ID
 */
export function createCorsHeaders(correlationId?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key, x-correlation-id',
    ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
  };
}

/**
 * Create error response with structured logging
 */
export function createErrorResponse(
  logger: EdgeLogger,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  logger.error(message, { code, status, details });
  logger.logRequestEnd(status);

  return new Response(
    JSON.stringify({
      error: message,
      code,
      request_id: logger.getCorrelationId(),
      ...(details ? { details } : {}),
    }),
    {
      status,
      headers: {
        ...createCorsHeaders(logger.getCorrelationId()),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create success response
 */
export function createSuccessResponse(
  logger: EdgeLogger,
  data: unknown,
  status = 200
): Response {
  logger.logRequestEnd(status);

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...createCorsHeaders(logger.getCorrelationId()),
        'Content-Type': 'application/json',
      },
    }
  );
}
