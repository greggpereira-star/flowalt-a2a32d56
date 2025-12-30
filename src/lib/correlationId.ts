/**
 * Correlation ID utilities for distributed tracing
 * Generates unique IDs to track requests across the system
 */

// Store correlation ID in session storage for persistence during navigation
const CORRELATION_ID_KEY = 'flowalt_correlation_id';
const SESSION_ID_KEY = 'flowalt_session_id';

/**
 * Generate a unique correlation ID
 * Format: timestamp-random for easy sorting and debugging
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Get or create a session ID (persists for the browser session)
 */
export function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateCorrelationId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Get current correlation ID for the active request chain
 */
export function getCurrentCorrelationId(): string {
  let correlationId = sessionStorage.getItem(CORRELATION_ID_KEY);
  if (!correlationId) {
    correlationId = generateCorrelationId();
    sessionStorage.setItem(CORRELATION_ID_KEY, correlationId);
  }
  return correlationId;
}

/**
 * Generate a new correlation ID for a new request chain
 */
export function refreshCorrelationId(): string {
  const newId = generateCorrelationId();
  sessionStorage.setItem(CORRELATION_ID_KEY, newId);
  return newId;
}

/**
 * Create correlation context for logging
 */
export function getCorrelationContext() {
  return {
    correlationId: getCurrentCorrelationId(),
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
}

/**
 * Format log message with correlation context
 */
export function formatLogMessage(message: string, context?: Record<string, unknown>): string {
  const correlationContext = getCorrelationContext();
  return JSON.stringify({
    message,
    ...correlationContext,
    ...context,
  });
}
