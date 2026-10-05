import { describe, expect, it } from 'vitest';
import { DISCLAIMER, MAX_AMOUNT_PKR, TaxInputError, calculateSalaryTax, formatSummary } from './calc.ts';
import { SLAB_TABLE } from './slabs.ts';

describe('test vectors (monthly gross, fully taxable)', () => {
  const vectors = [
    // monthly gross, annual, annual tax, monthly tax, monthly take-home
    [50_000, 600_000, 0, 0, 50_000],
    [100_000, 1_200_000, 6_000, 500, 99_500],
    [150_000, 1_800_000, 72_000, 6_000, 144_000],
    [200_000, 2_400_000, 156_000, 13_000, 187_000],
    [250_000, 3_000_000, 276_000, 23_000, 227_000],
    [500_000, 6_000_000, 1_104_000, 92_000, 408_000],
    [1_000_000, 12_000_000, 3_174_000, 264_500, 735_500],
  ] as const;

  it.each(vectors)('monthly %i', (monthly, annual, annualTax, monthlyTax, takeHome) => {
    const r = calculateSalaryTax(monthly, 'monthly');
    expect(r.annualIncome).toBe(annual);
    expect(r.annualTax).toBe(annualTax);
    expect(r.monthlyTax).toBe(monthlyTax);
    expect(r.monthlyTakeHome).toBe(takeHome);
  });

  it('reports rates and slab for 150,000 monthly', () => {
    const r = calculateSalaryTax(150_000, 'monthly');
    expect(r.slab).toBe(3);
    expect(r.marginalRatePercent).toBe(11);
    expect(r.effectiveRatePercent).toBe(4);
  });
});

describe('boundaries', () => {
  it('annual 0 is slab 1 with no tax', () => {
    const r = calculateSalaryTax(0, 'annual');
    expect(r.slab).toBe(1);
    expect(r.annualTax).toBe(0);
    expect(r.effectiveRatePercent).toBe(0);
  });

  const edges = SLAB_TABLE.slabs.slice(0, -1).map((s, i) => ({ edge: s.to!, lower: s, next: SLAB_TABLE.slabs[i + 1]! }));

  it('covers all seven slab edges', () => {
    expect(edges).toHaveLength(7);
  });

  it.each(edges)('edge $edge belongs to the lower slab and tax equals the next fixed tax', ({ edge, lower, next }) => {
    const atEdge = calculateSalaryTax(edge, 'annual');
    expect(atEdge.slab).toBe(lower.slab);
    expect(atEdge.annualTax).toBe(next.fixedTax);
    expect(next.from).toBe(edge);
    expect(calculateSalaryTax(edge + 1, 'annual').slab).toBe(next.slab);
  });
});

describe('annual input and rounding', () => {
  it('annual 1,800,000 matches the 150,000 monthly vector', () => {
    const r = calculateSalaryTax(1_800_000, 'annual');
    expect(r.monthlyGross).toBe(150_000);
    expect(r.monthlyTax).toBe(6_000);
    expect(r.monthlyTakeHome).toBe(144_000);
  });

  it('monthly gross from annual is annual / 12 rounded half up', () => {
    expect(calculateSalaryTax(1_000_006, 'annual').monthlyGross).toBe(83_334); // 83,333.83
    expect(calculateSalaryTax(1_000_002, 'annual').monthlyGross).toBe(83_334); // 83,333.5
    expect(calculateSalaryTax(1_000_001, 'annual').monthlyGross).toBe(83_333); // 83,333.42
  });

  it('annual tax rounds half up', () => {
    expect(calculateSalaryTax(600_050, 'annual').annualTax).toBe(1); // 0.5
    expect(calculateSalaryTax(600_049, 'annual').annualTax).toBe(0); // 0.49
  });

  it('monthly tax is annual tax / 12 rounded half up', () => {
    const r = calculateSalaryTax(601_800, 'annual'); // annual tax 18, 18 / 12 = 1.5
    expect(r.annualTax).toBe(18);
    expect(r.monthlyTax).toBe(2);
  });

  it('take-home from annual is monthly gross minus monthly tax, each rounded separately', () => {
    const r = calculateSalaryTax(1_000_002, 'annual'); // gross 83,333.5, tax 4,000 / 12 = 333.33
    expect(r.monthlyGross).toBe(83_334);
    expect(r.monthlyTax).toBe(333);
    expect(r.monthlyTakeHome).toBe(83_001); // (annual - annual tax) / 12 would round to 83,000
  });

  it('decimal input is rounded half up to a whole rupee first', () => {
    expect(calculateSalaryTax(150_000.5, 'monthly').monthlyGross).toBe(150_001);
    expect(calculateSalaryTax(150_000.49, 'monthly').monthlyGross).toBe(150_000);
  });
});

describe('validation', () => {
  it.each([-1, 'abc', '150000', null, undefined, NaN, Infinity])('rejects amount %s', (amount) => {
    expect(() => calculateSalaryTax(amount, 'monthly')).toThrow(TaxInputError);
  });

  it('rejects negative with a clear message', () => {
    expect(() => calculateSalaryTax(-1, 'monthly')).toThrow('amount cannot be negative');
  });

  it('rejects non-numeric with a clear message', () => {
    expect(() => calculateSalaryTax('abc', 'monthly')).toThrow('amount must be a number in PKR');
  });

  it('rejects above 10 billion with a clear message and accepts exactly 10 billion', () => {
    expect(() => calculateSalaryTax(MAX_AMOUNT_PKR + 1, 'annual')).toThrow('above the 10 billion PKR limit');
    expect(() => calculateSalaryTax(MAX_AMOUNT_PKR + 1, 'monthly')).toThrow(TaxInputError);
    expect(calculateSalaryTax(MAX_AMOUNT_PKR, 'monthly').slab).toBe(8);
  });

  it('rejects an unknown period', () => {
    expect(() => calculateSalaryTax(150_000, 'weekly')).toThrow('period must be "monthly" or "annual"');
  });
});

describe('every result carries tax year, source status, rounding note and disclaimer', () => {
  it.each([
    [0, 'annual'],
    [150_000, 'monthly'],
    [12_000_000, 'annual'],
  ] as const)('%i %s', (amount, period) => {
    const r = calculateSalaryTax(amount, period);
    expect(r.taxYear).toContain('Tax Year 2027');
    expect(r.sourceStatus).toContain('Unverified');
    expect(r.roundingNote).toContain('half up');
    expect(r.disclaimer).toBe(DISCLAIMER);
    expect(r.disclaimer).toContain('Not tax advice');

    const summary = formatSummary(r);
    for (const part of [r.taxYear, r.sourceStatus, r.roundingNote, r.disclaimer]) {
      expect(summary).toContain(part);
    }
    expect(summary).not.toContain('\u2014'); // no em-dashes
  });

  it('summary states the 150,000 monthly figures', () => {
    const summary = formatSummary(calculateSalaryTax(150_000, 'monthly'));
    expect(summary).toContain('Monthly tax: Rs 6,000.');
    expect(summary).toContain('Monthly take-home: Rs 144,000.');
    expect(summary).toContain('Marginal rate: 11% (slab 3 of 8).');
  });
});
