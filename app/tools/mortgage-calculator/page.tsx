import type { Metadata } from 'next'
import MortgageCalculator from './MortgageCalculator'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Mortgage Calculator',
  description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
  alternates: { canonical: `${siteUrl}/tools/mortgage-calculator` },
  openGraph: {
    title: 'Mortgage Calculator | Ryan Realty',
    description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
    url: `${siteUrl}/tools/mortgage-calculator`,
    type: 'website',
  },
}

type Props = {
  searchParams: Promise<{
    price?: string
    down?: string
    rate?: string
    term?: string
  }>
}

export default async function MortgageCalculatorPage({ searchParams }: Props) {
  const sp = await searchParams
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialDown = sp.down != null ? parseInt(sp.down, 10) : undefined
  const initialRate = sp.rate != null ? parseFloat(sp.rate) : undefined
  const initialTerm = sp.term != null ? parseInt(sp.term, 10) : undefined
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Mortgage calculator</h1>
      <p className="mt-1 text-muted-foreground">
        Estimate your monthly payment. Adjust home price, down payment, rate, and term.
      </p>
      <MortgageCalculator
        initialHomePrice={initialPrice}
        initialDownPaymentPct={initialDown}
        initialInterestRate={initialRate}
        initialLoanTermYears={initialTerm}
      />
    </main>
  )
}
