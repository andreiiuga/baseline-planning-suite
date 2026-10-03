import { describe, expect, it } from 'vitest';
import type { RateRecord } from '../../src/domain/model';
import {
  addRate,
  correctRate,
  rateTimeline,
  removeRate,
  type RateHistoryResult,
} from '../../src/domain/rateHistory';
import { isValidIsoDate } from '../../src/domain/isoDate';
import seed from '../../../../docs/baseline-seed.json';

const rate = (id: string, validFrom: string, hourlyCost: number): RateRecord => ({
  id,
  employeeId: 'emp-001',
  validFrom,
  hourlyCost,
});
const okafor: readonly RateRecord[] = seed.rateRecords.filter((r) => r.employeeId === 'emp-001');
const dates = (history: readonly RateRecord[]) => history.map((r) => r.validFrom);

function expectHistory(result: RateHistoryResult): readonly RateRecord[] {
  if (!result.ok) throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`);
  return result.history;
}

describe('isValidIsoDate', () => {
  it.each(['2026-03-12', '2028-02-29', '2025-01-01'])('accepts %s', (text) => {
    expect(isValidIsoDate(text)).toBe(true);
  });
  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '26-03-12', '2026-3-2', ''])(
    'rejects %j',
    (text) => {
      expect(isValidIsoDate(text)).toBe(false);
    },
  );
});

describe('addRate', () => {
  it('adds a later rate and keeps the history sorted', () => {
    const history = expectHistory(
      addRate(okafor, {
        id: 'new',
        employeeId: 'emp-001',
        validFrom: '2026-09-01',
        hourlyCost: '100',
      }),
    );
    expect(dates(history)).toEqual(['2025-01-01', '2026-03-12', '2026-09-01']);
  });

  it('adds a retroactive rate before the first record', () => {
    const history = expectHistory(
      addRate(okafor, {
        id: 'old',
        employeeId: 'emp-001',
        validFrom: '2024-06-15',
        hourlyCost: '70.5',
      }),
    );
    expect(dates(history)[0]).toBe('2024-06-15');
    expect(history[0]?.hourlyCost).toBe(70.5);
  });

  it('inserts between two existing records', () => {
    const history = expectHistory(
      addRate(okafor, {
        id: 'mid',
        employeeId: 'emp-001',
        validFrom: '2025-07-01',
        hourlyCost: '85',
      }),
    );
    expect(dates(history)).toEqual(['2025-01-01', '2025-07-01', '2026-03-12']);
  });

  it('starts a history from nothing', () => {
    const history = expectHistory(
      addRate([], {
        id: 'first',
        employeeId: 'emp-002',
        validFrom: '2026-01-01',
        hourlyCost: '60',
      }),
    );
    expect(history).toHaveLength(1);
  });

  it('refuses a second record on the same date', () => {
    const result = addRate(okafor, {
      id: 'dup',
      employeeId: 'emp-001',
      validFrom: '2026-03-12',
      hourlyCost: '99',
    });
    expect(result).toEqual({ ok: false, errors: { validFrom: 'date-duplicate' } });
  });

  it('does not mutate its input', () => {
    const before = [...okafor];
    addRate(okafor, { id: 'x', employeeId: 'emp-001', validFrom: '2030-01-01', hourlyCost: '1' });
    expect(okafor).toEqual(before);
  });

  it.each([
    ['', 'date-required'],
    ['   ', 'date-required'],
    ['2026-02-30', 'date-invalid'],
    ['12/03/2026', 'date-invalid'],
  ] as const)('refuses date %j with %s', (validFrom, code) => {
    expect(
      addRate(okafor, { id: 'x', employeeId: 'emp-001', validFrom, hourlyCost: '90' }),
    ).toEqual({
      ok: false,
      errors: { validFrom: code },
    });
  });

  it.each([
    ['', 'cost-required'],
    ['abc', 'cost-invalid'],
    ['-5', 'cost-invalid'],
    ['1e3', 'cost-invalid'],
    ['NaN', 'cost-invalid'],
    ['Infinity', 'cost-invalid'],
    ['0', 'cost-not-positive'],
    ['0.00', 'cost-not-positive'],
    ['95.555', 'cost-too-precise'],
  ] as const)('refuses cost %j with %s', (hourlyCost, code) => {
    expect(
      addRate(okafor, { id: 'x', employeeId: 'emp-001', validFrom: '2030-01-01', hourlyCost }),
    ).toEqual({
      ok: false,
      errors: { hourlyCost: code },
    });
  });

  it.each(['95', '95.5', '95.50', ' 95 ', '0.01'])('accepts cost %j', (hourlyCost) => {
    expect(
      addRate(okafor, { id: 'x', employeeId: 'emp-001', validFrom: '2030-01-01', hourlyCost }).ok,
    ).toBe(true);
  });

  it('reports both fields when both are wrong', () => {
    const result = addRate(okafor, {
      id: 'x',
      employeeId: 'emp-001',
      validFrom: 'nope',
      hourlyCost: '',
    });
    expect(result).toEqual({
      ok: false,
      errors: { validFrom: 'date-invalid', hourlyCost: 'cost-required' },
    });
  });
});

describe('correctRate', () => {
  const history = [
    rate('a', '2025-01-01', 80),
    rate('b', '2026-03-12', 95),
    rate('c', '2026-09-01', 100),
  ];

  it('corrects only the cost', () => {
    const next = expectHistory(
      correctRate(history, 'b', { validFrom: '2026-03-12', hourlyCost: '96' }),
    );
    expect(next.find((r) => r.id === 'b')?.hourlyCost).toBe(96);
  });

  it('lets a record keep its own date', () => {
    expect(correctRate(history, 'b', { validFrom: '2026-03-12', hourlyCost: '95' }).ok).toBe(true);
  });

  it('moves a record to a new date and re-sorts', () => {
    const next = expectHistory(
      correctRate(history, 'c', { validFrom: '2025-06-01', hourlyCost: '100' }),
    );
    expect(next.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('moves the first record retroactively', () => {
    const next = expectHistory(
      correctRate(history, 'a', { validFrom: '2020-01-01', hourlyCost: '80' }),
    );
    expect(dates(next)[0]).toBe('2020-01-01');
  });

  it('refuses a correction that would collide with another record date', () => {
    expect(correctRate(history, 'c', { validFrom: '2026-03-12', hourlyCost: '100' })).toEqual({
      ok: false,
      errors: { validFrom: 'date-duplicate' },
    });
  });

  it('throws for an unknown record, which is a programming error', () => {
    expect(() =>
      correctRate(history, 'ghost', { validFrom: '2026-01-01', hourlyCost: '1' }),
    ).toThrow(RangeError);
  });
});

describe('removeRate', () => {
  it('removes a record from the middle', () => {
    const history = [
      rate('a', '2025-01-01', 80),
      rate('b', '2026-03-12', 95),
      rate('c', '2026-09-01', 100),
    ];
    expect(removeRate(history, 'b').map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('allows removing the first record', () => {
    const history = [rate('a', '2025-01-01', 80), rate('b', '2026-03-12', 95)];
    expect(removeRate(history, 'a').map((r) => r.id)).toEqual(['b']);
  });

  it('allows removing the only record, leaving an empty history', () => {
    expect(removeRate([rate('a', '2025-01-01', 80)], 'a')).toEqual([]);
  });

  it('ignores an unknown id', () => {
    const history = [rate('a', '2025-01-01', 80)];
    expect(removeRate(history, 'ghost')).toEqual(history);
  });
});

describe('rateTimeline', () => {
  it('ends each rate where the next begins and leaves the last one open', () => {
    expect(rateTimeline(okafor).map((r) => [r.validFrom, r.validUntil])).toEqual([
      ['2025-01-01', '2026-03-12'],
      ['2026-03-12', null],
    ]);
  });

  it('sorts defensively', () => {
    expect(
      rateTimeline([rate('b', '2026-03-12', 95), rate('a', '2025-01-01', 80)]).map((r) => r.id),
    ).toEqual(['a', 'b']);
  });
});
