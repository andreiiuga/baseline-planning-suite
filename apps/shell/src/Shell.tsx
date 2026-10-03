import { useMemo, useState } from 'react';
import { createEventBus } from './bus/eventBus';
import { CURRENCIES, currencyByCode } from './chrome/currency';
import { USERS, userById } from './chrome/session';
import { readPreference, writePreference } from './chrome/storage';
import type { RemoteName } from './config';
import type { DeliveryAppProps, PeopleAppProps } from './contracts';
import type { Ports } from './compose';
import { markVisited } from './navigation';
import { RemotePanel } from './RemotePanel';

const SECTIONS: readonly { readonly name: RemoteName; readonly label: string }[] = [
  { name: 'people', label: 'People' },
  { name: 'delivery', label: 'Delivery' },
];

export function Shell({ ports }: { readonly ports: Ports }) {
  const bus = useMemo(() => createEventBus(), []);
  const [active, setActive] = useState<RemoteName>('people');
  const [visited, setVisited] = useState<ReadonlySet<RemoteName>>(() => new Set(['people']));
  const [currency, setCurrency] = useState(() => currencyByCode(readPreference('currency')));
  const [activeUser, setActiveUser] = useState(() => userById(readPreference('user')));

  const peopleProps: PeopleAppProps = {
    allocationTotals: ports.allocationTotals,
    bus,
    currency,
    activeUser,
  };
  const deliveryProps: DeliveryAppProps = {
    employeeQuery: ports.employeeQuery,
    rateQuery: ports.rateQuery,
    bus,
    currency,
    activeUser,
  };

  const show = (name: RemoteName) => {
    setActive(name);
    setVisited((current) => markVisited(current, name));
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <h1>Baseline</h1>
        <nav aria-label="Sections">
          {SECTIONS.map(({ name, label }) => (
            <button
              key={name}
              type="button"
              aria-current={active === name ? 'page' : undefined}
              onClick={() => show(name)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="shell-controls">
          <label>
            Currency
            <select
              value={currency.code}
              onChange={(event) => {
                setCurrency(currencyByCode(event.target.value));
                writePreference('currency', event.target.value);
              }}
            >
              {CURRENCIES.map(({ code }) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Signed in as
            <select
              value={activeUser.id}
              onChange={(event) => {
                setActiveUser(userById(event.target.value));
                writePreference('user', event.target.value);
              }}
            >
              {USERS.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main>
        {SECTIONS.map(({ name }) =>
          visited.has(name) ? (
            <div key={name} data-panel={name} hidden={active !== name}>
              {name === 'people' ? (
                <RemotePanel name="people" appProps={peopleProps} />
              ) : (
                <RemotePanel name="delivery" appProps={deliveryProps} />
              )}
            </div>
          ) : null,
        )}
      </main>
    </div>
  );
}
