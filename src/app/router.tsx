/** Routes (SRS §12.1). Lead-owned wiring. Every screen sits in its own ErrorBoundary (NFR-REL-04). */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, useLocation } from 'react-router-dom';
import { t } from '@/i18n/vi';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';

const PlaybookPage = lazy(() => import('@/features/playbook/PlaybookPage'));
const EditorPage = lazy(() => import('@/features/editor/EditorPage'));
const MatchupPage = lazy(() => import('@/features/matchup/MatchupPage'));
const InstallListPage = lazy(() => import('@/features/install/InstallListPage'));
const InstallDetailPage = lazy(() => import('@/features/install/InstallDetailPage'));
const PresentPage = lazy(() => import('@/features/install/PresentPage'));
const RosterPage = lazy(() => import('@/features/roster/RosterPage'));
const SuggestPage = lazy(() => import('@/features/suggest/SuggestPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function Screen({ children }: { children: ReactNode }): JSX.Element {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<div className="p-6">{t.common.loading}</div>}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Screen>
            <PlaybookPage />
          </Screen>
        ),
      },
      {
        path: 'play/new',
        element: (
          <Screen>
            <EditorPage />
          </Screen>
        ),
      },
      {
        path: 'play/:id',
        element: (
          <Screen>
            <EditorPage />
          </Screen>
        ),
      },
      {
        path: 'matchup/new',
        element: (
          <Screen>
            <MatchupPage />
          </Screen>
        ),
      },
      {
        path: 'matchup/:id',
        element: (
          <Screen>
            <MatchupPage />
          </Screen>
        ),
      },
      {
        path: 'install',
        element: (
          <Screen>
            <InstallListPage />
          </Screen>
        ),
      },
      {
        path: 'install/:id',
        element: (
          <Screen>
            <InstallDetailPage />
          </Screen>
        ),
      },
      {
        path: 'roster',
        element: (
          <Screen>
            <RosterPage />
          </Screen>
        ),
      },
      {
        path: 'suggest',
        element: (
          <Screen>
            <SuggestPage />
          </Screen>
        ),
      },
      {
        path: 'settings',
        element: (
          <Screen>
            <SettingsPage />
          </Screen>
        ),
      },
    ],
  },
  // Present mode is fullscreen, outside the app frame.
  {
    path: '/install/:id/present',
    element: (
      <Screen>
        <PresentPage />
      </Screen>
    ),
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
