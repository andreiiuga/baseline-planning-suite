import type { Employee } from './model';

const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Case- and accent-insensitive search over name and role. Every whitespace-separated term
 * must match somewhere, so "tech okafor" finds A. Okafor, Tech Lead.
 */
export function searchEmployees(employees: readonly Employee[], query: string): Employee[] {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...employees];
  return employees.filter((employee) => {
    const haystack = normalise(`${employee.name} ${employee.role}`);
    return terms.every((term) => haystack.includes(term));
  });
}
