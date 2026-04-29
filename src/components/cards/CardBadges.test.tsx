import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UrgencyBadge, StatusBadge } from './CardBadges';

/**
 * Regression tests for property badges in the task detail modal.
 *
 * Bug: at narrow viewports the "Prioridade" select trigger forced the
 * urgency badge to wrap the icon onto one line and the label onto the
 * next ("🚩 / Crítica"). The fix relies on `whitespace-nowrap` plus
 * `flex-shrink-0` icons and a tooltip (`title`) fallback.
 *
 * These tests guard the contract — not the visual pixels — so a future
 * refactor can't silently drop those classes.
 */

describe('Property badges — single-line guarantee', () => {
  it('UrgencyBadge keeps icon + label on the same line', () => {
    render(<UrgencyBadge urgency="critical" />);
    const badge = screen.getByTestId('urgency-badge');

    // The badge itself never wraps
    expect(badge.className).toMatch(/whitespace-nowrap/);
    // …and the inner label span repeats the rule so a flex shrink can't
    // squeeze a line break in.
    const label = badge.querySelector('span.whitespace-nowrap');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('Crítica');

    // Icon must not shrink to zero width and trigger a wrap
    const icon = badge.querySelector('svg');
    expect(icon?.getAttribute('class') ?? '').toMatch(/flex-shrink-0/);
  });

  it('UrgencyBadge exposes the full label as a tooltip fallback', () => {
    render(<UrgencyBadge urgency="critical" />);
    expect(screen.getByTestId('urgency-badge')).toHaveAttribute('title', 'Crítica');
  });

  it('StatusBadge keeps dot + label on the same line and offers a tooltip', () => {
    render(<StatusBadge status="in_progress" showChevron />);
    const badge = screen.getByTestId('status-badge');

    expect(badge.className).toMatch(/whitespace-nowrap/);
    expect(badge).toHaveAttribute('title', 'Em Produção');

    // Both the status dot and the chevron must be marked non-shrinkable
    // so they can never collapse and force a wrap.
    const nonShrinkable = badge.querySelectorAll('.flex-shrink-0');
    expect(nonShrinkable.length).toBeGreaterThanOrEqual(2);
  });

  it('Badges render correctly across all urgency variants', () => {
    const variants = ['low', 'medium', 'high', 'critical'] as const;
    for (const v of variants) {
      const { unmount } = render(<UrgencyBadge urgency={v} />);
      const badge = screen.getByTestId('urgency-badge');
      expect(badge.className).toMatch(/whitespace-nowrap/);
      expect(badge.getAttribute('title')).toBeTruthy();
      unmount();
    }
  });
});
