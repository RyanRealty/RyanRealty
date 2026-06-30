import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Inbound block-list check for the Twilio webhooks. A blocked number's calls are
 * rejected and its texts dropped. Matched on the canonical last-10 digits.
 * Uncached on purpose — a block must take effect on the very next inbound hit.
 */
function last10(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

export async function isNumberBlocked(phone: string | null | undefined): Promise<boolean> {
  const ten = last10(phone)
  if (!ten) return false
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_blocked_numbers')
    .select('id')
    .eq('phone_last10', ten)
    .limit(1)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

/**
 * StirVerstat (SHAKEN/STIR) spam heuristic. Carriers label low-attestation calls
 * "Spam Likely". We treat a verification FAILURE or the lowest attestation level
 * (C) as suspected spam. Absent/blank StirVerstat = unknown (not flagged — many
 * legitimate calls carry no PASSporT).
 */
export function isStirSpamSuspected(stirVerstat: string | null | undefined): boolean {
  const s = String(stirVerstat ?? '').trim()
  if (!s) return false
  return /Failed/i.test(s) || /-C$/i.test(s)
}
