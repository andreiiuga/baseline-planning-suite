import { describe, expect, it } from 'vitest';
import type { Employee } from '../../src/domain/model';
import { searchEmployees } from '../../src/domain/search';
import seed from '../../../../docs/baseline-seed.json';

const employees: readonly Employee[] = seed.employees;
const ids = (found: readonly Employee[]) => found.map((e) => e.id);

describe('searchEmployees', () => {
  it('returns everyone for an empty or blank query', () => {
    expect(searchEmployees(employees, '')).toHaveLength(60);
    expect(searchEmployees(employees, '   ')).toHaveLength(60);
  });

  it('finds A. Okafor by surname, case-insensitively', () => {
    expect(ids(searchEmployees(employees, 'okafor'))).toContain('emp-001');
    expect(ids(searchEmployees(employees, 'OKAFOR'))).toContain('emp-001');
  });

  it('matches roles as well as names', () => {
    const found = searchEmployees(employees, 'tech lead');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((e) => /tech lead/i.test(e.role))).toBe(true);
  });

  it('requires every term to match', () => {
    const found = searchEmployees(employees, 'tech okafor');
    expect(ids(found)).toContain('emp-001');
    expect(found.every((e) => /okafor/i.test(e.name) && /tech/i.test(e.role))).toBe(true);
  });

  it('ignores accents on either side', () => {
    const people: Employee[] = [{ id: 'x', name: 'Zoë Müller', role: 'Analyst', weeklyHours: 40 }];
    expect(searchEmployees(people, 'zoe muller')).toHaveLength(1);
    expect(searchEmployees(people, 'ZOË')).toHaveLength(1);
  });

  it('returns nothing for a term that matches nobody', () => {
    expect(searchEmployees(employees, 'zzzzqq')).toEqual([]);
  });

  it('returns a copy, never the input array', () => {
    expect(searchEmployees(employees, '')).not.toBe(employees);
  });
});
