import { useEffect, useState } from 'react';
import type { DeliveryAppProps } from './AppProps';
import { unavailableRateQuery } from './adapters/unavailablePeople';

export default function App({ rateQuery, currency, activeUser }: DeliveryAppProps) {
  const [rates, setRates] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    let current = true;
    void (rateQuery ?? unavailableRateQuery)
      .getRates(['emp-001'])
      .then((result) => current && setRates(result.status === 'ok' ? 'available' : 'unavailable'));
    return () => {
      current = false;
    };
  }, [rateQuery]);

  return (
    <section aria-label="Delivery">
      <h2>Delivery</h2>
      <p>
        Signed in as {activeUser.name} · showing {currency.code}
      </p>
      <p data-testid="rates-status">Cost rates: {rates}</p>
    </section>
  );
}
