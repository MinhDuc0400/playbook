/** Root: bootstrap once, then render the router. Lead-owned wiring. */
import { useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { t } from '@/i18n/vi';
import { bootstrap } from './bootstrap';
import { createAppRouter } from './router';
import { useApplyTheme } from './theme';

function ThemeApplier(): null {
  useApplyTheme();
  return null;
}

export function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  const router = useMemo(() => createAppRouter(), []);
  useEffect(() => {
    void bootstrap().finally(() => setReady(true));
  }, []);
  if (!ready) return <div className="p-6">{t.common.loading}</div>;
  return (
    <>
      <ThemeApplier />
      <RouterProvider router={router} />
    </>
  );
}
