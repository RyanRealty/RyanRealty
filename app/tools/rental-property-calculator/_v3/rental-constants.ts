export const ROUTE_PATH = '/tools/rental-property-calculator'

export const RENTAL_TRACE =
  'Starting interest rate for Central Oregon. Cached six hours. Rent, tax, and expenses start as editable defaults on the calculator.'

/**
 * One derivation for the visible Quiet FAQ and the FAQPage JSON-LD.
 * Answers match the engine in lib/rental-analysis.ts.
 */
export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'What is cash flow on a rental property?',
    answer:
      'Cash flow is what is left each month after the mortgage, property taxes, insurance, management, and maintenance reserves are paid out of the rent. Positive cash flow means the rent covers every cost with money to spare.',
  },
  {
    question: 'What is cap rate?',
    answer:
      'Cap rate is the annual net operating income divided by the purchase price, shown as a percent. It measures the yield of the property independent of how you finance it.',
  },
  {
    question: 'What is cash-on-cash return?',
    answer:
      'Cash-on-cash return compares your annual cash flow to the cash you put in, including the down payment, closing costs, and any upfront work. It shows the yearly return on the actual dollars you invested.',
  },
  {
    question: 'Are these rental numbers a guarantee?',
    answer:
      'No. The figures are estimates based on the numbers you enter, not investment advice or a guarantee of rent, value, or return. We can pull real rent comps and help you underwrite a specific property.',
  },
]
