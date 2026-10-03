import { useEffect, useState } from 'react';
import type { PeopleAppProps } from './AppProps';
import { unavailableAllocationTotals } from './adapters/unavailableDelivery';

export default function App({ allocationTotals, currency, activeUser }: PeopleAppProps) {
  const [capacity, setCapacity] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    let current = true;
    void (allocationTotals ?? unavailableAllocationTotals)
      .getMonthlyTotals(['emp-003'])
      .then(
        (result) => current && setCapacity(result.status === 'ok' ? 'available' : 'unavailable'),
      );
    return () => {
      current = false;
    };
  }, [allocationTotals]);

  return (
    <section aria-label="People">
      <h2>People</h2>
      <p>
        Signed in as {activeUser.name} · showing {currency.code}
      </p>
      <p data-testid="capacity-status">Capacity data: {capacity}</p>
    </section>
  );
}
