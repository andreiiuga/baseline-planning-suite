import { describe, expect, it, vi } from 'vitest';
import { composePorts } from '../src/compose';
import type {
  AllocationTotalsPort,
  DeliveryApi,
  EmployeeQueryPort,
  PeopleApi,
  RateQueryPort,
} from '../src/contracts';
import { loadApis } from '../src/loadApis';

const employeeQuery: EmployeeQueryPort = {
  listEmployees: () => Promise.resolve({ status: 'unavailable' }),
};
const rateQuery: RateQueryPort = { getRates: () => Promise.resolve({ status: 'unavailable' }) };
const allocationTotals: AllocationTotalsPort = {
  getMonthlyTotals: () => Promise.resolve({ status: 'unavailable' }),
};
const peopleApi: PeopleApi = {
  createEmployeeQuery: () => employeeQuery,
  createRateQuery: () => rateQuery,
};
const deliveryApi: DeliveryApi = { createAllocationTotals: () => allocationTotals };

describe('composePorts', () => {
  it('wires each provider to the ports the other app consumes', () => {
    expect(composePorts(peopleApi, deliveryApi)).toEqual({
      employeeQuery,
      rateQuery,
      allocationTotals,
    });
  });

  it('leaves Delivery without People ports when People did not load', () => {
    expect(composePorts(null, deliveryApi)).toEqual({
      employeeQuery: null,
      rateQuery: null,
      allocationTotals,
    });
  });

  it('leaves People without capacity data when Delivery did not load', () => {
    expect(composePorts(peopleApi, null)).toEqual({
      employeeQuery,
      rateQuery,
      allocationTotals: null,
    });
  });

  it('copes with both remotes down', () => {
    expect(composePorts(null, null)).toEqual({
      employeeQuery: null,
      rateQuery: null,
      allocationTotals: null,
    });
  });
});

describe('loadApis', () => {
  const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  it('returns both apis when both load', async () => {
    const load = <T>(id: string) =>
      Promise.resolve((id === 'people/api' ? peopleApi : deliveryApi) as unknown as T);
    expect(await loadApis(load)).toEqual({ people: peopleApi, delivery: deliveryApi });
  });

  it('turns a failed remote into null and keeps the other', async () => {
    const spy = warn();
    const load = <T>(id: string) =>
      id === 'people/api'
        ? Promise.reject<T>(new Error('network down'))
        : Promise.resolve(deliveryApi as unknown as T);
    expect(await loadApis(load)).toEqual({ people: null, delivery: deliveryApi });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('treats a module that resolves to nothing as unavailable', async () => {
    const spy = warn();
    const load = <T>() => Promise.resolve(undefined as T | undefined);
    expect(await loadApis(load)).toEqual({ people: null, delivery: null });
    spy.mockRestore();
  });

  it('gives up on a remote that never answers instead of hanging the shell', async () => {
    vi.useFakeTimers();
    const spy = warn();
    const load = <T>(id: string) =>
      id === 'people/api'
        ? new Promise<T>(() => undefined)
        : Promise.resolve(deliveryApi as unknown as T);
    const pending = loadApis(load);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ people: null, delivery: deliveryApi });
    spy.mockRestore();
    vi.useRealTimers();
  });
});
