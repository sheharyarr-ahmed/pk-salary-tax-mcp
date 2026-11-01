// The only place slab thresholds and rates exist.
// Amounts are annual taxable income in PKR. Rates are integer percents.

export interface Slab {
  slab: number;
  from: number;
  to: number | null; // null: no upper bound
  fixedTax: number;
  ratePercent: number; // charged on the excess over `from`
}

export const SLAB_TABLE = {
  version: '2027.1',
  taxYear: 'Tax Year 2027 (1 July 2026 to 30 June 2027)',
  sourceStatus:
    'Rates from the Finance Act 2026 (Gazette of Pakistan, 26 June 2026), First Schedule, Part I, Division I, clause (2).',
  slabs: [
    { slab: 1, from: 0, to: 600_000, fixedTax: 0, ratePercent: 0 },
    { slab: 2, from: 600_000, to: 1_200_000, fixedTax: 0, ratePercent: 1 },
    { slab: 3, from: 1_200_000, to: 2_200_000, fixedTax: 6_000, ratePercent: 11 },
    { slab: 4, from: 2_200_000, to: 3_200_000, fixedTax: 116_000, ratePercent: 20 },
    { slab: 5, from: 3_200_000, to: 4_100_000, fixedTax: 316_000, ratePercent: 25 },
    { slab: 6, from: 4_100_000, to: 5_600_000, fixedTax: 541_000, ratePercent: 29 },
    { slab: 7, from: 5_600_000, to: 7_000_000, fixedTax: 976_000, ratePercent: 32 },
    { slab: 8, from: 7_000_000, to: null, fixedTax: 1_424_000, ratePercent: 35 },
  ] as readonly Slab[],
} as const;
