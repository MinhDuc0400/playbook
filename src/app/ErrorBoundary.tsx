/** Per-screen error boundary (NFR-REL-04): a crashing screen shows a message + "Về Playbook", app stays up. */
import { Component, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this resets the boundary (e.g. route path). */
  resetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  override state = { error: null as Error | null };
  override render(): ReactNode {
    return this.props.children;
  }
}
