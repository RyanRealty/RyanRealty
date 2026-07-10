'use server'

/**
 * One-click Broker Price Opinion from a CRM contact record.
 *
 * startBpoForContactAction(personId)
 *   → resolve the contact's owned home from CRM geo, run the deterministic BPO
 *     builder (lib/bpo/build.ts), land a broker_price_opinions row in status
 *     'draft' linked to the person. Review-first: nothing is emailed. The draft
 *     opens at /admin/bpo/<slug> and shows on the contact card.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { buildBpo } from '@/lib/bpo/build'
import { sendBpoToLead } from '@/lib/bpo/send'
import { slugifyBpoAddress } from '@/lib/bpo/slug'
import { parseContactAddress } from '@/lib/crm/contact-cma-address'

export type StartBpoResult = { ok: true; slug: string } | { ok: false; error: string }
export type SendBpoContactResult = { ok: true; transport: 'gmail' | 'resend' } | { ok: false; error: string }

async function resolveHomeAddress(
  personId: number,
): Promise<{ rawAddress: string; city: string; postalCode: string | null } | { error: string }> {
  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { error: 'Contact not found' }
  const fubPersonId = (person.fub_legacy_id as number | null) ?? null
  let homeAddress: string | null = null
  if (fubPersonId) {
    const { data: geo } = await sb
      .from('fub_person_geo')
      .select('formatted_address,source_address')
      .eq('fub_person_id', fubPersonId)
      .maybeSingle()
    homeAddress =
      (geo?.formatted_address as string | null)?.trim() ||
      (geo?.source_address as string | null)?.trim() ||
      null
  }
  if (!homeAddress) return { error: 'No home on file for this contact. Add the owner address first.' }
  const parsed = parseContactAddress(homeAddress)
  if (!parsed || !parsed.parsedCity) return { error: 'Could not read a city from the home address on file.' }
  return { rawAddress: parsed.rawAddress, city: parsed.parsedCity, postalCode: parsed.parsedPostalCode ?? null }
}

export async function startBpoForContactAction(personId: number): Promise<StartBpoResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A valid contact id is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const home = await resolveHomeAddress(personId)
    if ('error' in home) return { ok: false, error: home.error }

    const slug = slugifyBpoAddress(home.rawAddress)
    const built = await buildBpo({
      slug,
      rawAddress: home.rawAddress,
      city: home.city,
      postalCode: home.postalCode,
      purpose: 'contact valuation',
      requestedBy: access.email,
      requestSource: 'crm-contact-card',
      client: { personId, clientName: null, clientEmail: null },
    })

    try {
      const sb = createServiceClient()
      await sb.from('crm_timeline').insert({
        person_id: personId,
        kind: 'system',
        title: built.ok ? 'Broker price opinion built' : 'Broker price opinion did not finish',
        body: built.ok
          ? `BPO for ${home.rawAddress} built as a draft. Review it at /admin/bpo/${slug}.`
          : `BPO build for ${home.rawAddress} failed: ${built.error ?? 'unknown error'}`,
        broker: access.brokerSlug,
        source: 'app',
        dedupe_key: `bpo:${built.ok ? 'built' : 'failed'}:${slug}:${new Date().toISOString().slice(0, 10)}`,
      })
    } catch {
      /* timeline is best-effort */
    }

    if (!built.ok) return { ok: false, error: built.error ?? 'BPO build did not finish.' }

    revalidatePath(`/admin/console/leads/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    revalidatePath('/admin/bpo')
    return { ok: true, slug }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error starting the BPO' }
  }
}

/** Send a finalized BPO to the contact. Client-safe (offer strategy stripped)
 *  unless includeOfferStrategy is set. Explicit-click only. */
export async function sendBpoForContactAction(
  personId: number,
  slug: string,
  includeOfferStrategy = false,
): Promise<SendBpoContactResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A valid contact id is required' }
    if (!slug?.trim()) return { ok: false, error: 'A broker price opinion is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const result = await sendBpoToLead({ personId, slug: slug.trim(), includeOfferStrategy })
    if (!result.ok) return { ok: false, error: result.error ?? 'Send failed' }

    revalidatePath(`/admin/console/leads/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    return { ok: true, transport: result.transport ?? 'resend' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error sending the BPO' }
  }
}
