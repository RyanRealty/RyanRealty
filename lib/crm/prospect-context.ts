import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * The outreach context for a reply-intent classification: is this person an
 * expired-listing or FSBO prospect, and what property address is on their
 * claim? Reply-intent classification only fires for prospects (the decision
 * scoped it to expired/FSBO outreach), so a null return means "not a prospect,
 * do not classify."
 *
 * Shared by both inbound channels — the Twilio inbound-SMS webhook and the
 * crm-gmail-sync email path (W5.3) — so email replies get the same suggested
 * reply + ?reply= deep link that texted replies do.
 */
export async function prospectOutreachContext(
  sb: SupabaseClient,
  personId: number,
): Promise<{ kind: 'expired' | 'fsbo' | null; address: string | null } | null> {
  const { data: person } = await sb
    .from('crm_people')
    .select('tags')
    .eq('id', personId)
    .maybeSingle()
  const tags: string[] = Array.isArray(person?.tags) ? (person.tags as string[]) : []
  const tagKind: 'expired' | 'fsbo' | null = tags.includes('intent:expired-listing')
    ? 'expired'
    : tags.includes('intent:fsbo')
      ? 'fsbo'
      : null

  const [expired, fsbo] = await Promise.all([
    sb
      .from('expired_listings')
      .select('street_address')
      .eq('outreach_crm_person_id', personId)
      .order('outreach_claim_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('fsbo_listings')
      .select('street_address')
      .eq('outreach_crm_person_id', personId)
      .order('outreach_claim_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])
  const claim = expired.data
    ? { kind: 'expired' as const, address: (expired.data.street_address as string | null) ?? null }
    : fsbo.data
      ? { kind: 'fsbo' as const, address: (fsbo.data.street_address as string | null) ?? null }
      : null

  if (!tagKind && !claim) return null
  return { kind: tagKind ?? claim?.kind ?? null, address: claim?.address ?? null }
}
