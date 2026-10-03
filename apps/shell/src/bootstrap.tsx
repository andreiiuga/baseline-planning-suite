import { registerRemotes } from '@module-federation/runtime';
import { createRoot } from 'react-dom/client';
import { composePorts } from './compose';
import { loadConfig, REMOTE_NAMES } from './config';
import { loadApis } from './loadApis';
import { Shell } from './Shell';
import './shell.css';

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

  // Composition root: load both api modules, wire ports once, then render. A remote that
  // fails to load yields a null port, never an exception.
  const { people, delivery } = await loadApis();
  root.render(<Shell ports={composePorts(people, delivery)} />);
}

void start();
