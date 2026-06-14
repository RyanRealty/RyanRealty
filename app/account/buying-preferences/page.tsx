import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { Card } from '@/components/ui/card'
import BuyingPreferencesForm from './BuyingPreferencesForm'

export const metadata: Metadata = {
  title: 'Buying preferences',
  description: 'Set your down payment, interest rate, and loan term to see estimated monthly payments on listings.',
}

export default async function BuyingPreferencesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const prefs = await getBuyingPreferences()

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Buying preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your down payment, interest rate, and loan term. We&apos;ll show an estimated monthly payment
          (principal and interest) on listing cards and listing pages while you&apos;re signed in.
        </p>
      </header>

      {/* ── Payment estimate inputs ── */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Payment estimate</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">These figures power the estimated monthly payment shown on listings.</p>
        </div>
        <Card className="max-w-md p-6">
          <BuyingPreferencesForm initial={prefs ?? undefined} />
        </Card>
      </section>
    </div>
  )
}
