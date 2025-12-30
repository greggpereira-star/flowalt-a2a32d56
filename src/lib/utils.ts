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

