import { createRoot } from 'react-dom/client';
import App from './App';
import { createFixtureAllocationTotals } from './adapters/fixtureDelivery';
import { silentEventBus } from './adapters/silentEventBus';
import totalsFixture from './adapters/seed/allocation-totals-fixture.json';

/** Standalone: no shell, so the app wires its own fixtures and ignores any config.json. */
const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(
  <App
    allocationTotals={createFixtureAllocationTotals(totalsFixture)}
    bus={silentEventBus}
    currency={{ code: 'EUR', perEur: 1 }}
    activeUser={{ id: 'standalone', name: 'Standalone user' }}
  />,
);
