interface PropertyParams {
  numRuns: number;
  seed?: number;
}

/** Random seed locally, fixed seed in CI so a red build is reproducible. */
export const propertyParams: PropertyParams = {
  numRuns: 300,
  ...(process.env['CI'] ? { seed: 20260401 } : {}),
};
