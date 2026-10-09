// Pure salary tax calculation. No I/O.

import { SLAB_TABLE, type Slab } from './slabs.ts';

export const MAX_AMOUNT_PKR = 10_000_000_000;

export type Period = 'monthly' | 'annual';

export interface SalaryTaxResult {
  period: Period;
  annualIncome: number;
  monthlyGross: number;
  annualTax: number;
  monthlyTax: number;
  monthlyTakeHome: number;
  effectiveRatePercent: number;
  marginalRatePercent: number;
  slab: number;
  taxYear: string;
  sourceStatus: string;
  roundingNote: string;
  disclaimer: string;
}

export const ROUNDING_NOTE =
  'Amounts are rounded to the nearest rupee, half up: the input amount, monthly gross from an annual amount (annual / 12), annual tax, and monthly tax (annual tax / 12).';

export const DISCLAIMER =
  'Estimate for salaried individuals, Tax Year 2027. Treats the full amount as taxable: deductions, allowances, tax credits and zakat are excluded. Not tax advice.';

export class TaxInputError extends Error {
  override name = 'TaxInputError';
}

// Round n / d half up. n is a non-negative integer, d an even positive integer.
function divRoundHalfUp(n: number, d: number): number {
  return Math.floor((n + d / 2) / d);
}

function findSlab(annualIncome: number): Slab {
  // An income exactly on an upper bound belongs to the lower slab.
  const slab = SLAB_TABLE.slabs.find((s) => s.to === null || annualIncome <= s.to);
  if (!slab) throw new Error('Slab table has no open-ended top slab');
  return slab;
}

export function calculateSalaryTax(amount: unknown, period: unknown): SalaryTaxResult {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TaxInputError('amount must be a number in PKR, for example 150000.');
  }
  if (amount < 0) {
    throw new TaxInputError('amount cannot be negative.');
  }
  if (amount > MAX_AMOUNT_PKR) {
    throw new TaxInputError('amount is above the 10 billion PKR limit this calculator supports.');
  }
  if (period !== 'monthly' && period !== 'annual') {
    throw new TaxInputError('period must be "monthly" or "annual".');
  }

  const rupees = Math.floor(amount + 0.5);
  const annualIncome = period === 'monthly' ? rupees * 12 : rupees;
  const monthlyGross = period === 'monthly' ? rupees : divRoundHalfUp(rupees, 12);

  const slab = findSlab(annualIncome);
  const annualTax = slab.fixedTax + divRoundHalfUp((annualIncome - slab.from) * slab.ratePercent, 100);
  const monthlyTax = divRoundHalfUp(annualTax, 12);
  const effectiveRatePercent =
    annualIncome === 0 ? 0 : Math.round((annualTax / annualIncome) * 10_000) / 100;

  return {
    period,
    annualIncome,
    monthlyGross,
    annualTax,
    monthlyTax,
    monthlyTakeHome: monthlyGross - monthlyTax,
    effectiveRatePercent,
    marginalRatePercent: slab.ratePercent,
    slab: slab.slab,
    taxYear: SLAB_TABLE.taxYear,
    sourceStatus: SLAB_TABLE.sourceStatus,
    roundingNote: ROUNDING_NOTE,
    disclaimer: DISCLAIMER,
  };
}

const pkr = (n: number) => `Rs ${n.toLocaleString('en-US')}`;

export function formatSummary(r: SalaryTaxResult): string {
  return [
    `${r.taxYear}, salaried individual.`,
    `Monthly gross salary ${pkr(r.monthlyGross)} (annual ${pkr(r.annualIncome)}).`,
    `Annual tax: ${pkr(r.annualTax)}. Monthly tax: ${pkr(r.monthlyTax)}. Monthly take-home: ${pkr(r.monthlyTakeHome)}.`,
    `Effective rate: ${r.effectiveRatePercent.toFixed(2)}%. Marginal rate: ${r.marginalRatePercent}% (slab ${r.slab} of ${SLAB_TABLE.slabs.length}).`,
    `Rounding: ${r.roundingNote}`,
    `Source: ${r.sourceStatus}`,
    `Disclaimer: ${r.disclaimer}`,
  ].join('\n');
}

export interface SalaryTaxSlabs {
  taxYear: string;
  version: string;
  sourceStatus: string;
  slabs: Slab[];
  disclaimer: string;
}

export function getSalaryTaxSlabs(): SalaryTaxSlabs {
  return {
    taxYear: SLAB_TABLE.taxYear,
    version: SLAB_TABLE.version,
    sourceStatus: SLAB_TABLE.sourceStatus,
    // Copies, so a caller cannot change the shared table.
    slabs: SLAB_TABLE.slabs.map((s) => ({ ...s })),
    disclaimer: DISCLAIMER,
  };
}

function formatSlab(s: Slab): string {
  const range = [s.from > 0 ? `above ${pkr(s.from)}` : '', s.to !== null ? `up to ${pkr(s.to)}` : '']
    .filter(Boolean)
    .join(' ');
  const rate = `${s.ratePercent}% of income above ${pkr(s.from)}`;
  const tax =
    s.ratePercent === 0 && s.fixedTax === 0 ? 'no tax' : s.fixedTax === 0 ? rate : `${pkr(s.fixedTax)} plus ${rate}`;
  return `Slab ${s.slab}: ${range}: ${tax}.`;
}

export function formatSlabTable(t: SalaryTaxSlabs): string {
  return [
    `${t.taxYear}, salaried individuals. Annual taxable income in PKR.`,
    ...t.slabs.map(formatSlab),
    'Each slab includes its upper bound.',
    `Source: ${t.sourceStatus}`,
    `Disclaimer: ${t.disclaimer}`,
  ].join('\n');
}
