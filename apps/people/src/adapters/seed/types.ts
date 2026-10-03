import type { Employee, RateRecord } from '../../domain/model';

export interface PeopleSeed {
  readonly seedVersion: number;
  readonly employees: readonly Employee[];
  readonly rateRecords: readonly RateRecord[];
}
