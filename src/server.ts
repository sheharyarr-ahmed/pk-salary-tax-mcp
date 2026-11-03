import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import {
  TaxInputError,
  calculateSalaryTax,
  formatSlabTable,
  formatSummary,
  getSalaryTaxSlabs,
} from './tax/calc.ts';

const outputSchema = {
  period: z.enum(['monthly', 'annual']),
  annualIncome: z.number().describe('Annual taxable income, PKR'),
  monthlyGross: z.number().describe('Monthly gross salary, PKR'),
  annualTax: z.number().describe('Annual income tax, PKR'),
  monthlyTax: z.number().describe('Monthly income tax, PKR'),
  monthlyTakeHome: z.number().describe('Monthly gross minus monthly tax, PKR'),
  effectiveRatePercent: z.number().describe('Annual tax as a percent of annual income'),
  marginalRatePercent: z.number().describe('Rate on the next rupee of income'),
  slab: z.number().describe('Slab number, 1 to 8'),
  taxYear: z.string(),
  sourceStatus: z.string(),
  roundingNote: z.string(),
  disclaimer: z.string(),
};

const slabsOutputSchema = {
  taxYear: z.string(),
  version: z.string().describe('Slab table version'),
  sourceStatus: z.string(),
  slabs: z.array(
    z.object({
      slab: z.number().describe('Slab number, 1 to 8'),
      from: z.number().describe('Lower bound of annual taxable income, PKR. The slab starts above it (slab 1 starts at 0)'),
      to: z.number().nullable().describe('Upper bound of annual taxable income, PKR, inclusive. Null for the top slab'),
      fixedTax: z.number().describe('Fixed annual tax for the slab, PKR'),
      ratePercent: z.number().describe('Rate charged on income above the lower bound'),
    }),
  ),
  disclaimer: z.string(),
};

function buildServer() {
  const server = new McpServer({ name: 'pk-salary-tax', version: '0.1.0' });

  server.registerTool(
    'calculate_salary_tax',
    {
      title: 'Calculate Pakistan salary tax (Tax Year 2027)',
      description:
        'Calculates Pakistan income tax for salaried individuals for Tax Year 2027 (1 July 2026 to 30 June 2027) from a gross salary in PKR, monthly or annual. ' +
        'Returns annual tax, monthly tax, monthly take-home, effective rate, marginal rate and slab number. ' +
        'These rates apply when salary is more than 75% of taxable income. ' +
        'The full amount is treated as taxable: deductions, allowances, tax credits and zakat are excluded. ' +
        'Accepts 0 to 10 billion PKR. Not tax advice.',
      inputSchema: {
        amount: z
          .number({ error: 'amount must be a number in PKR, for example 150000.' })
          .describe('Gross salary in PKR, 0 to 10,000,000,000'),
        period: z.enum(['monthly', 'annual']).describe('Whether amount is a monthly or an annual salary'),
      },
      outputSchema,
      annotations: { title: 'Calculate Pakistan salary tax (Tax Year 2027)', readOnlyHint: true },
    },
    async ({ amount, period }) => {
      try {
        const result = calculateSalaryTax(amount, period);
        return {
          content: [{ type: 'text', text: formatSummary(result) }],
          structuredContent: { ...result },
        };
      } catch (err) {
        if (err instanceof TaxInputError) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
        throw err;
      }
    },
  );

  server.registerTool(
    'get_salary_tax_slabs',
    {
      title: 'Pakistan salary tax slabs (Tax Year 2027)',
      description:
        'Lists the 8 Pakistan income tax slabs for salaried individuals for Tax Year 2027 (1 July 2026 to 30 June 2027). ' +
        "Each slab gives an annual taxable income range in PKR, a fixed tax, and a rate on the income above the slab's lower bound. " +
        'Annual amounts only. These rates apply when salary is more than 75% of taxable income. Deductions, allowances, tax credits and zakat are excluded. Not tax advice.',
      outputSchema: slabsOutputSchema,
      annotations: { title: 'Pakistan salary tax slabs (Tax Year 2027)', readOnlyHint: true },
    },
    async () => {
      const table = getSalaryTaxSlabs();
      return {
        content: [{ type: 'text', text: formatSlabTable(table) }],
        structuredContent: { ...table },
      };
    },
  );
  return server;
}

// Hostnames allowed past the DNS rebinding check: localhost, the Vercel production domain and
// this deployment's URL (set by Vercel), and ALLOWED_HOSTS (comma-separated, for example a tunnel).
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  '[::1]',
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '',
  process.env.VERCEL_URL ?? '',
  ...(process.env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()),
].filter(Boolean);

// Same setup as the SDK's createMcpExpressApp. Vercel only detects an Express app whose entry file imports express.
const app = express();
app.use(hostHeaderValidation(allowedHosts));
app.use(express.json());

// Stateless Streamable HTTP: each POST gets a fresh server and transport, no sessions.
app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const notAllowed = (_req: Request, res: Response) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

// On Vercel (VERCEL=1) the default export is the handler. Listen only when run locally.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 3000);
  app.listen(PORT, '127.0.0.1', (err) => {
    if (err) {
      console.error(`failed to listen on ${PORT}: ${err.message}`);
      process.exit(1);
    }
    console.log(`pk-salary-tax listening on http://localhost:${PORT}/mcp`);
  });
}

export default app;
