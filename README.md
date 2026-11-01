# PK Salary Tax

A connector for Claude that calculates Pakistan income tax for salaried individuals for Tax Year 2027 (1 July 2026 to 30 June 2027), and lists the salary tax slabs.

Documentation: https://pk-salary-tax-mcp.vercel.app/

## Connect it

In Claude, go to Customize, Connectors, Add, Add custom connector, and paste:

```text
https://pk-salary-tax-mcp.vercel.app/mcp
```

No account or sign-in is needed.

## Tools

- `calculate_salary_tax`: takes a gross salary in PKR and whether it is monthly or annual. Returns annual tax, monthly tax, monthly take-home pay, effective rate, marginal rate and slab number.
- `get_salary_tax_slabs`: takes no input. Lists all 8 salary tax slabs, in annual amounts.

Both tools are read-only.

## Example prompts

1. What are the Pakistan salary tax slabs for this tax year?
2. How much tax on a 150,000 monthly salary?
3. I earn Rs 2,400,000 a year. What is my effective tax rate?

## Limits

- The rates apply when salary is more than 75% of taxable income.
- The full amount is treated as taxable: deductions, allowances, tax credits and zakat are excluded.
- Non-salaried, business and pension income and earlier tax years are not covered.
- Decimal inputs are rounded half up to a whole rupee first. Annual tax is rounded to the nearest rupee, half up. Monthly tax is annual tax / 12, rounded the same way.

## Troubleshooting

If a tool does not run, check that the connector is enabled for the chat. Amounts must be numbers from 0 to 10 billion PKR.

## Source

Rates from the Finance Act 2026 (Gazette of Pakistan, 26 June 2026), First Schedule, Part I, Division I, clause (2). [Read the Act on the FBR website](https://download1.fbr.gov.pk/Docs/20266291261044366FinanceAct2026.pdf).

## Before you rely on a result

Results are estimates and not tax advice. Check your own position with a tax professional or the FBR before filing.

## Privacy and support

- [Privacy policy](https://pk-salary-tax-mcp.vercel.app/privacy.html)
- Support: sheharyar.softwareengineer@gmail.com

Not affiliated with the Federal Board of Revenue or the Government of Pakistan.
