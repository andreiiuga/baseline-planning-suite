import {
  Component,
  lazy,
  Suspense,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { loadRemote } from '@module-federation/runtime';
import type { ComponentType } from 'react';
import type { RemoteName } from './config';
import { withTimeout } from './timeout';

const LOAD_TIMEOUT_MS = 5000;

interface RemoteModule<P> {
  readonly default: ComponentType<P>;
}

function loadApp<P extends object>(name: RemoteName): Promise<RemoteModule<P>> {
  const load = loadRemote<RemoteModule<P>>(`${name}/App`);
  return withTimeout(load, LOAD_TIMEOUT_MS, name).then((module) => {
    if (!module) throw new Error(`${name}/App resolved to nothing`);
    return module;
  });
}

interface BoundaryProps {
  readonly name: RemoteName;
  readonly onRetry: () => void;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly error: Error | null;
}

class RemoteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[shell] ${this.props.name} failed`, error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" data-remote={this.props.name} data-state="unavailable">
        <strong>{this.props.name} is unavailable</strong>
        <p>{error.message}</p>
        <button type="button" onClick={this.props.onRetry}>
          Retry
        </button>
      </div>
    );
  }
}

export function RemotePanel<P extends object>({
  name,
  appProps,
}: {
  readonly name: RemoteName;
  /** Injected into the remote's App: ports, bus, currency, active user. */
  readonly appProps: P;
}) {
  const [attempt, setAttempt] = useState(0);
  // A new lazy component per attempt so Retry actually reloads the remote.
  const Remote = useMemo(() => lazy(() => loadApp<P>(name)), [name, attempt]);

  return (
    <RemoteErrorBoundary key={attempt} name={name} onRetry={() => setAttempt((n) => n + 1)}>
      <Suspense fallback={<p>Loading {name}…</p>}>
        <Remote {...appProps} />
      </Suspense>
    </RemoteErrorBoundary>
  );
}
