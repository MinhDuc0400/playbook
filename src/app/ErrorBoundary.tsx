/** Per-screen error boundary (NFR-REL-04): a crashing screen shows a message + "Về Playbook", app stays up. */
import { Component, type ReactNode } from 'react';
import { t } from '@/i18n/vi';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this resets the boundary (e.g. route path). */
  resetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown): void {
    console.error('Screen crashed', error);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        className="m-6 max-w-xl rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      >
        <p className="font-semibold">{t.common.screenError}</p>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer">{t.common.errorDetails}</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
        <a
          href="/"
          className="mt-3 inline-block rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t.common.backToPlaybook}
        </a>
      </div>
    );
  }
}
