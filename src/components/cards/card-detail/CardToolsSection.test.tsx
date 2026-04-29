import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ----------------------------------------------------------------------------
// Mocks for the heavy panels — we only care about which panel is rendered for
// the active tab, not the panel internals (which depend on Supabase / queries).
// ----------------------------------------------------------------------------
vi.mock('../ChecklistPanel', () => ({
  ChecklistPanel: ({ cardId }: { cardId: string }) => (
    <div data-testid="panel-checklist">checklist:{cardId}</div>
  ),
}));
vi.mock('../TimeTrackingPanel', () => ({
  TimeTrackingPanel: () => <div data-testid="panel-time" />,
}));
vi.mock('../AttachmentsPanel', () => ({
  AttachmentsPanel: ({ cardId }: { cardId: string }) => (
    <div data-testid="panel-attachments">attachments:{cardId}</div>
  ),
}));
vi.mock('../CardExecutionAssistantWrapper', () => ({
  CardExecutionAssistantWrapper: () => <div data-testid="panel-assistant" />,
}));
vi.mock('../TagManagerWrapper', () => ({
  TagManagerWrapper: () => <div data-testid="panel-tags" />,
}));
vi.mock('../CardFinancialTab', () => ({
  CardFinancialTab: () => <div data-testid="panel-financial" />,
}));
vi.mock('../CardKitTab', () => ({
  CardKitTab: () => <div data-testid="panel-kit" />,
}));
vi.mock('../CardInvitePanel', () => ({
  CardInvitePanel: ({ cardId }: { cardId: string }) => (
    <div data-testid="panel-invites">invites:{cardId}</div>
  ),
}));
vi.mock('@/components/social-media/SocialPostButton', () => ({
  SocialPostButton: () => <button>SocialPostButton</button>,
}));

import { CardToolsSection } from './CardToolsSection';
import { TaskInlineActions } from './TaskInlineActions';

/**
 * Harness that mirrors how CardDetailSheet wires inline actions to the tools
 * section: a single source of truth (`activeTab`) flows down, handlers only
 * call `setActiveTab`. This is exactly the contract the modal relies on.
 */
const Harness: React.FC<{ initial?: string }> = ({ initial = 'checklist' }) => {
  const [activeTab, setActiveTab] = useState(initial);

  return (
    <div>
      <TaskInlineActions
        onAddSubtask={() => setActiveTab('checklist')}
        onCreateChecklist={() => setActiveTab('checklist')}
        onAttachFile={() => setActiveTab('attachments')}
        onLinkItems={() => setActiveTab('invites')}
      />
      <CardToolsSection
        cardId="card-1"
        clientId={null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        checklistCompleted={0}
        checklistTotal={0}
        attachmentsCount={0}
        hasSocialPublish={false}
        socialPostsCount={0}
      />
    </div>
  );
};

describe('Card tools inline actions', () => {
  it('renders a single tools section (no duplicate components)', () => {
    render(<Harness />);
    expect(screen.getAllByTestId('card-tools-section')).toHaveLength(1);
    // Default tab is checklist → exactly one checklist panel mounted
    expect(screen.getAllByTestId('panel-checklist')).toHaveLength(1);
  });

  it('"Adicionar subtarefa" opens the checklist tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial="attachments" />);

    // Sanity: starts on attachments
    expect(screen.getByTestId('panel-attachments')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adicionar subtarefa/i }));

    const section = screen.getByTestId('card-tools-section');
    expect(within(section).getByTestId('panel-checklist')).toBeInTheDocument();
    // Still exactly one tools section in the tree
    expect(screen.getAllByTestId('card-tools-section')).toHaveLength(1);
  });

  it('"Criar checklist" opens the checklist tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial="invites" />);

    await user.click(screen.getByRole('button', { name: /criar checklist/i }));

    const section = screen.getByTestId('card-tools-section');
    expect(within(section).getByTestId('panel-checklist')).toBeInTheDocument();
    expect(screen.getAllByTestId('panel-checklist')).toHaveLength(1);
  });

  it('"Anexar arquivo" opens the attachments tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial="checklist" />);

    await user.click(screen.getByRole('button', { name: /anexar arquivo/i }));

    const section = screen.getByTestId('card-tools-section');
    expect(within(section).getByTestId('panel-attachments')).toBeInTheDocument();
    expect(screen.getAllByTestId('panel-attachments')).toHaveLength(1);
  });

  it('switching tabs does not duplicate panels in the DOM', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /anexar arquivo/i }));
    await user.click(screen.getByRole('button', { name: /criar checklist/i }));
    await user.click(screen.getByRole('button', { name: /anexar arquivo/i }));

    // Radix Tabs unmounts inactive panels — only the active one stays mounted,
    // and the tools section itself is rendered exactly once.
    expect(screen.queryAllByTestId('panel-checklist').length).toBeLessThanOrEqual(1);
    expect(screen.getAllByTestId('panel-attachments')).toHaveLength(1);
    expect(screen.getAllByTestId('card-tools-section')).toHaveLength(1);
  });
});
