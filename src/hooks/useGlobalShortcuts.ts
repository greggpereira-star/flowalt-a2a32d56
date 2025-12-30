import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
}

export const useGlobalShortcuts = (
  customShortcuts?: Record<string, ShortcutHandler>
) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Navigation shortcuts with G prefix
  const handleGPrefixedShortcut = useCallback((key: string) => {
    const routes: Record<string, string> = {
      'h': '/',
      'd': '/dashboard',
      'c': '/calendar',
      's': '/settings',
      'a': '/analytics',
      't': '/tasks',
      'f': '/financial',
      'p': '/partners',
      'g': '/gamification',
      'o': '/coordination',
    };

    const route = routes[key.toLowerCase()];
    if (route) {
      navigate(route);
      return true;
    }
    return false;
  }, [navigate]);

  // View shortcuts with V prefix
  const handleVPrefixedShortcut = useCallback((key: string) => {
    const views: Record<string, string> = {
      'k': 'kanban',
      'l': 'list',
      'g': 'gantt',
      'c': 'calendar',
    };

    const view = views[key.toLowerCase()];
    if (view) {
      // Dispatch custom event for view change
      window.dispatchEvent(new CustomEvent('flowalt:viewChange', { detail: { view } }));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let gPressed = false;
    let vPressed = false;
    let prefixTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle G-prefix shortcuts
      if (gPressed) {
        e.preventDefault();
        handleGPrefixedShortcut(e.key);
        gPressed = false;
        return;
      }

      // Handle V-prefix shortcuts
      if (vPressed) {
        e.preventDefault();
        handleVPrefixedShortcut(e.key);
        vPressed = false;
        return;
      }

      // Set prefix state
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        gPressed = true;
        prefixTimeout = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        vPressed = true;
        prefixTimeout = setTimeout(() => { vPressed = false; }, 500);
        return;
      }

      // Timer shortcut (T)
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flowalt:toggleTimer'));
        return;
      }

      // New card shortcut (N)
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flowalt:newCard'));
        return;
      }

      // Search shortcut (/)
      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flowalt:focusSearch'));
        return;
      }

      // Custom shortcuts from props
      if (customShortcuts) {
        const key = e.key.toLowerCase();
        if (customShortcuts[key]) {
          e.preventDefault();
          customShortcuts[key]();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (prefixTimeout) clearTimeout(prefixTimeout);
    };
  }, [handleGPrefixedShortcut, handleVPrefixedShortcut, customShortcuts]);
};

// Hook to listen for specific shortcut events
export const useShortcutEvent = (event: string, handler: (e?: Event) => void) => {
  useEffect(() => {
    const listener = (e: Event) => handler(e);
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  }, [event, handler]);
};
