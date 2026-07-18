import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImmersiveProvider, useImmersive } from '@/lib/focus/ImmersiveContext';
import { AppShell } from '@/components/layout/AppShell';

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

function ImmersiveToggleButton() {
  const { immersive, setImmersive } = useImmersive();
  return <button onClick={() => setImmersive(!immersive)}>toggle</button>;
}

describe('AppShell', () => {
  it('shows the sidebar by default', () => {
    render(
      <ImmersiveProvider>
        <AppShell onQuickAdd={vi.fn()}>content</AppShell>
      </ImmersiveProvider>
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('hides the sidebar while immersive mode is active', () => {
    render(
      <ImmersiveProvider>
        <ImmersiveToggleButton />
        <AppShell onQuickAdd={vi.fn()}>content</AppShell>
      </ImmersiveProvider>
    );
    act(() => { screen.getByText('toggle').click(); });
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });

  it('always renders children', () => {
    render(
      <ImmersiveProvider>
        <AppShell onQuickAdd={vi.fn()}>
          <div data-testid="page-content">content</div>
        </AppShell>
      </ImmersiveProvider>
    );
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });
});
