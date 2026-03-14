import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
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
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Buying preferences</h1>
      <p className="mt-1 text-muted-foreground">
        Save your down payment, interest rate, and loan term. We’ll show an estimated monthly payment (principal and interest) on listing cards and listing pages when you’re signed in.
      </p>
      <BuyingPreferencesForm initial={prefs ?? undefined} />
    </>
  )
}
