'use server'

import { createClient } from '@/lib/supabase/server'

export type BrokerageSettingsRow = {
  id: string
  name: string
  logo_url: string | null
  tagline: string | null
  primary_email: string | null
  primary_phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  updated_at: string
}

const DEFAULT_ID = 'a0000000-0000-0000-0000-000000000001'

export async function getBrokerageSettings(): Promise<BrokerageSettingsRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brokerage_settings')
    .select('id, name, logo_url, tagline, primary_email, primary_phone, address_line1, address_line2, city, state, postal_code, updated_at')
    .eq('id', DEFAULT_ID)
    .single()
  return data as BrokerageSettingsRow | null
}
