import { createRoot } from 'react-dom/client';
import App from './App';
import { createFixtureEmployeeQuery, createFixtureRateQuery } from './adapters/fixturePeople';
import { silentEventBus } from './adapters/silentEventBus';
import peopleFixture from './adapters/seed/people-fixture.json';

/** Standalone: no shell, so the app wires its own fixtures and ignores any config.json. */
const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(
  <App
    employeeQuery={createFixtureEmployeeQuery(peopleFixture)}
    rateQuery={createFixtureRateQuery(peopleFixture)}
    bus={silentEventBus}
    currency={{ code: 'EUR', perEur: 1 }}
    activeUser={{ id: 'standalone', name: 'Standalone user' }}
  />,
);
