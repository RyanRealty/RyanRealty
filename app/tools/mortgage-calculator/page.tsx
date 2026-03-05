import type { Metadata } from 'next'
import MortgageCalculator from './MortgageCalculator'

export const metadata: Metadata = {
  title: 'Mortgage Calculator',
  description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
}

type Props = { searchParams: Promise<{ price?: string }> }

export default async function MortgageCalculatorPage({ searchParams }: Props) {
  const sp = await searchParams
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Mortgage calculator</h1>
      <p className="mt-1 text-zinc-600">
        Estimate your monthly payment. Adjust home price, down payment, rate, and term.
      </p>
      <MortgageCalculator initialHomePrice={initialPrice} />
    </main>
  )
}
