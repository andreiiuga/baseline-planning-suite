import { registerRemotes } from '@module-federation/runtime';
import { createRoot } from 'react-dom/client';
import { loadConfig, REMOTE_NAMES } from './config';
import { RemotePanel } from './RemotePanel';

function Fatal({ reason }: { readonly reason: string }) {
  return (
    <div role="alert">
      <h1>Baseline cannot start</h1>
      <p>{reason}</p>
    </div>
  );
}

async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  const root = createRoot(container);

  const result = await loadConfig();
  if (!result.ok) {
    root.render(<Fatal reason={result.reason} />);
    return;
  }

  registerRemotes(
    REMOTE_NAMES.map((name) => ({ name, entry: result.config.remotes[name], type: 'module' })),
    { force: true },
  );

  root.render(
    <main>
      <h1>Baseline Planning Suite</h1>
      {REMOTE_NAMES.map((name) => (
        <RemotePanel key={name} name={name} />
      ))}
    </main>,
  );
}

void start();
