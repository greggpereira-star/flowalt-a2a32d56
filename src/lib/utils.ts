import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro.'
): string {
  if (!error) return fallback;

  if (typeof error === 'string') return error;

  if (error instanceof Error) return error.message || fallback;

  if (typeof error === 'object') {
    const anyErr = error as any;
    const message = typeof anyErr.message === 'string' ? anyErr.message : null;
    const details = typeof anyErr.details === 'string' ? anyErr.details : null;
    const hint = typeof anyErr.hint === 'string' ? anyErr.hint : null;
    const code = typeof anyErr.code === 'string' ? anyErr.code : null;

    const parts = [
      message,
      details && details !== message ? details : null,
      hint,
      code ? `Código: ${code}` : null,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' • ');

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function generateId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();

  // Simple UUID v4 fallback
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

