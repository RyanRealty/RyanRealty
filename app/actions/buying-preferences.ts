'use server'

import { createClient } from '@/lib/supabase/server'

export type BuyingPreferences = {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

const DEFAULTS: BuyingPreferences = {
  downPaymentPercent: 20,
  interestRate: 7,
  loanTermYears: 30,
}

export async function getBuyingPreferences(): Promise<BuyingPreferences | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_buying_preferences')
    .select('down_payment_percent, interest_rate, loan_term_years')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!data) return null
  const row = data as { down_payment_percent: number; interest_rate: number; loan_term_years: number }
  return {
    downPaymentPercent: Number(row.down_payment_percent) || DEFAULTS.downPaymentPercent,
    interestRate: Number(row.interest_rate) ?? DEFAULTS.interestRate,
    loanTermYears: Number(row.loan_term_years) || DEFAULTS.loanTermYears,
  }
}

export async function setBuyingPreferences(prefs: Partial<BuyingPreferences>): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const down = prefs.downPaymentPercent != null ? Math.min(100, Math.max(0, prefs.downPaymentPercent)) : 20
  const rate = prefs.interestRate != null ? Math.min(20, Math.max(0, prefs.interestRate)) : 7
  const term = [10, 15, 20, 30].includes(Number(prefs.loanTermYears)) ? Number(prefs.loanTermYears) : 30
  const { error } = await supabase.from('user_buying_preferences').upsert(
    {
      user_id: user.id,
      down_payment_percent: down,
      interest_rate: rate,
      loan_term_years: term,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) return { error: error.message }
  return { error: null }
}
