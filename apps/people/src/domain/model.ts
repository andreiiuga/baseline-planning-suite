export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly weeklyHours: number;
}

export interface RateRecord {
  readonly id: string;
  readonly employeeId: string;
  /** YYYY-MM-DD, inclusive. The rate runs until the next record's validFrom, or forever. */
  readonly validFrom: string;
  /** EUR per hour. */
  readonly hourlyCost: number;
}
