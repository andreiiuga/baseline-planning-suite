import { useEffect, useMemo, useRef, useState } from 'react';
import { createEventBus } from './bus/eventBus';
import { CURRENCIES, currencyByCode } from './chrome/currency';
import { USERS, userById } from './chrome/session';
import { readPreference, writePreference } from './chrome/storage';
import type { RemoteName } from './config';
import type { DeliveryAppProps, PeopleAppProps } from './contracts';
import type { Ports } from './compose';
import { markVisited, SECTIONS, titleFor } from './navigation';
import { RemotePanel } from './RemotePanel';
import { SectionLink } from './SectionLink';
import { useRoute } from './useRoute';

export function Shell({ ports }: { readonly ports: Ports }) {
  const bus = useMemo(() => createEventBus(), []);
  const { active, navigate } = useRoute();
  const [visited, setVisited] = useState<ReadonlySet<RemoteName>>(() => new Set([active]));
  // Whatever the URL points at is mounted now (no extra render first); the state keeps it mounted.
  const mounted = markVisited(visited, active);
  useEffect(() => setVisited(mounted), [mounted]);
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

  // Title follows the section, and focus moves to the panel after a navigation so keyboard and
  // screen-reader users land in the new content rather than on the link they just used.
  const panels = useRef(new Map<RemoteName, HTMLDivElement>());
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = titleFor(active);
    if (firstRender.current) firstRender.current = false;
    else panels.current.get(active)?.focus();
  }, [active]);

  return (
    <div className="shell">
      <header className="shell-header">
        <h1>Baseline</h1>
        <nav aria-label="Sections">
          {SECTIONS.map(({ name, label }) => (
            <SectionLink key={name} name={name} active={active === name} onNavigate={navigate}>
              {label}
            </SectionLink>
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
          mounted.has(name) ? (
            <div
              key={name}
              data-panel={name}
              hidden={active !== name}
              tabIndex={-1}
              ref={(element) => {
                if (element) panels.current.set(name, element);
                else panels.current.delete(name);
              }}
            >
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
