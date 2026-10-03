import { describe, expect, it } from 'vitest';
import type { Employee } from '../../src/domain/model';
import type { EmployeeQuery } from '../../src/ports/peopleQueries';

export function runEmployeeQueryContract(
  label: string,
  create: () => Promise<EmployeeQuery>,
): void {
  async function employees(): Promise<Employee[]> {
    const result = await (await create()).listEmployees();
    if (result.status !== 'ok') throw new Error('expected an available EmployeeQuery');
    return result.data;
  }

  describe(`EmployeeQuery contract (${label})`, () => {
    it('lists employees with id, name and weekly hours of 40, 32 or 20', async () => {
      const list = await employees();
      expect(list.length).toBeGreaterThan(0);
      for (const employee of list) {
        expect(employee.id).toMatch(/^emp-\d+$/);
        expect(employee.name.length).toBeGreaterThan(0);
        expect([40, 32, 20]).toContain(employee.weeklyHours);
      }
    });

    it('includes A. Okafor on 40 hours a week', async () => {
      expect((await employees()).find((e) => e.id === 'emp-001')).toMatchObject({
        id: 'emp-001',
        weeklyHours: 40,
      });
    });

    it('lists each employee once', async () => {
      const ids = (await employees()).map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}
