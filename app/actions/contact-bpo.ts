'use server'

/**
 * One-click Broker Price Opinion from a CRM contact record.
 *
 * startBpoForContactAction(personId, subjectListingKey?)
 *   → default (no listing key): resolve the contact's owned home from CRM geo
 *     (seller-side). With subjectListingKey: the subject is the listing the
 *     contact is shopping (buyer-side, e.g. the Homes tab "Draft BPO" action on
 *     a viewed home). Either way the deterministic BPO builder (lib/bpo/build.ts)
 *     lands a broker_price_opinions row in status 'draft' linked to the person.
 *     Review-first: nothing is emailed. The draft opens at /admin/bpo/<slug>
 *     and shows on the contact card.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { buildBpo } from '@/lib/bpo/build'
import { sendBpoToLead, prepareBpoSendPreview, type BpoSendOverride } from '@/lib/bpo/send'
import { slugifyBpoAddress } from '@/lib/bpo/slug'
import { resolveWritableBpoSlot } from '@/lib/cma/versions'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { parseContactAddress } from '@/lib/crm/contact-cma-address'
import { sendTemplateSelfTestAction } from '@/app/actions/crm-template-test'

export type StartBpoResult =
  | { ok: true; slug: string; existing?: boolean }
  | { ok: false; error: string }
export type SendBpoContactResult = { ok: true; transport: 'gmail' | 'resend' } | { ok: false; error: string }

/** The /admin/bpo worklist compose dialog's prefill context. */
export interface BpoSendContext {
  subject: string
  bodyText: string
  docUrl: string
  recipientEmail: string | null
  recipientName: string | null
  subjectAddress: string
  personId: number | null
}

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

/**
 * Idempotency guard for the buyer-side path: one live BPO per
 * (person, subject listing). A prior failed draft (build_error set, no usable
 * document) does not block a retry, and an archived BPO does not block a
 * fresh one. Returns the existing slug when a live draft/final already covers
 * this pair.
 */
async function findLiveBpoForPersonListing(personId: number, listingKey: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('broker_price_opinions')
    .select('slug,status,build_error')
    .eq('person_id', personId)
    .eq('subject_listing_key', listingKey)
    .is('archived_at', null)
    .in('status', ['draft', 'final'])
    .order('created_at', { ascending: false })
    .limit(1)
  const row = (data?.[0] ?? null) as { slug?: string | null; status?: string | null; build_error?: string | null } | null
  if (!row?.slug) return null
  if (row.status === 'draft' && row.build_error) return null
  return row.slug
}

export async function startBpoForContactAction(
  personId: number,
  subjectListingKey?: string | null,
): Promise<StartBpoResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A valid contact id is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const listingKey = subjectListingKey?.trim() || null

    // Resolve the subject per entry point. Seller-side (default): the
    // contact's owned home. Buyer-side (listingKey): the listing the contact
    // is shopping — subject resolves by MLS key, and the slug is scoped to the
    // person so two leads shopping the same house never share (or clobber)
    // one draft.
    let rawAddress: string
    let baseSlug: string
    let subjectInput: { mlsNumber?: string; rawAddress?: string; city?: string | null; postalCode?: string | null }
    let purpose: string
    let requestSource: string

    if (listingKey) {
      const existing = await findLiveBpoForPersonListing(personId, listingKey)
      if (existing) return { ok: true, slug: existing, existing: true }

      const resolved = await resolveCmaSubject({ mlsNumber: listingKey })
      if (!resolved.subject) {
        return { ok: false, error: `Listing ${listingKey} could not be resolved. ${resolved.trace}` }
      }
      const s = resolved.subject
      // Stored subject_listing_key is listings.ListingKey — re-check when the
      // caller passed an MLS ListNumber that maps to a different ListingKey.
      if (s.listingKey && s.listingKey !== listingKey) {
        const byResolved = await findLiveBpoForPersonListing(personId, s.listingKey)
        if (byResolved) return { ok: true, slug: byResolved, existing: true }
      }
      rawAddress = [s.streetAddress, s.city].filter(Boolean).join(', ')
      baseSlug = `${slugifyBpoAddress(rawAddress)}-p${personId}`
      subjectInput = { mlsNumber: listingKey }
      purpose = 'buyer valuation'
      requestSource = 'crm-viewed-home'
    } else {
      const home = await resolveHomeAddress(personId)
      if ('error' in home) return { ok: false, error: home.error }
      rawAddress = home.rawAddress
      baseSlug = slugifyBpoAddress(home.rawAddress)
      subjectInput = { rawAddress: home.rawAddress, city: home.city, postalCode: home.postalCode }
      purpose = 'contact valuation'
      requestSource = 'crm-contact-card'
    }

    // Land the build on a writable slot: rebuild the open draft in place, or
    // open a new --vN document after a 'final' BPO — never reset a final
    // document (and its live /bpo/[slug] link) back to draft
    // (lib/cma/versions.ts — the upsert-by-slug clobber class).
    const slot = await resolveWritableBpoSlot(baseSlug)
    if (!slot.ok) return { ok: false, error: slot.error }
    const slug = slot.slug
    const built = await buildBpo({
      slug,
      ...subjectInput,
      purpose,
      requestedBy: access.email,
      requestSource,
      client: { personId, clientName: null, clientEmail: null },
    })

    try {
      const sb = createServiceClient()
      await sb.from('crm_timeline').insert({
        person_id: personId,
        kind: 'system',
        title: built.ok ? 'Broker price opinion built' : 'Broker price opinion did not finish',
        body: built.ok
          ? `BPO for ${rawAddress} built as a draft. Review it at /admin/bpo/${slug}.`
          : `BPO build for ${rawAddress} failed: ${built.error ?? 'unknown error'}`,
        broker: access.brokerSlug,
        source: 'app',
        dedupe_key: `bpo:${built.ok ? 'built' : 'failed'}:${slug}:${new Date().toISOString().slice(0, 10)}`,
      })
    } catch {
      /* timeline is best-effort */
    }

    if (!built.ok) return { ok: false, error: built.error ?? 'BPO build did not finish.' }

    revalidatePath(`/admin/crm/${personId}`)
    revalidatePath('/admin/bpo')
    return { ok: true, slug }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error starting the BPO' }
  }
}

/** Send a finalized BPO to the contact. Client-safe (offer strategy stripped)
 *  unless includeOfferStrategy is set. Explicit-click only. `override` carries
 *  a broker-edited subject/body from a compose dialog (e.g. the /admin/bpo
 *  worklist send dialog) — omit to send the default composed message. */
export async function sendBpoForContactAction(
  personId: number,
  slug: string,
  includeOfferStrategy = false,
  override?: BpoSendOverride,
): Promise<SendBpoContactResult> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'A valid contact id is required' }
    if (!slug?.trim()) return { ok: false, error: 'A broker price opinion is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const result = await sendBpoToLead({ personId, slug: slug.trim(), includeOfferStrategy, override })
    if (!result.ok) return { ok: false, error: result.error ?? 'Send failed' }

    revalidatePath(`/admin/crm/${personId}`)
    revalidatePath(`/admin/crm/${personId}`)
    return { ok: true, transport: result.transport ?? 'resend' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error sending the BPO' }
  }
}

/**
 * /admin/bpo worklist compose-dialog prefill. Resolves the recipient straight
 * from the BPO's linked person_id (a BPO has no bare-email send path — see
 * lib/bpo/send.ts's prepareBpoSendPreview docblock) and scopes access to that
 * contact. Read-only; does not send anything.
 */
export async function prepareBpoSendPreviewAction(
  slug: string,
): Promise<{ ok: true; context: BpoSendContext } | { ok: false; error: string }> {
  try {
    if (!slug?.trim()) return { ok: false, error: 'A broker price opinion is required' }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }

    const preview = await prepareBpoSendPreview(slug.trim())
    if (!preview.ok) return preview
    if (preview.personId == null) {
      return { ok: false, error: 'Link a contact on the BPO detail page to send.' }
    }
    const scoped = await requirePersonInScope(preview.personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const { ok: _ok, ...context } = preview
    void _ok
    return { ok: true, context }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error preparing the send preview' }
  }
}

/** "Send test to myself" for the /admin/bpo worklist compose dialog — thin
 *  forward to the shared self-test send (app/actions/crm-template-test.ts),
 *  same reuse pattern as app/actions/prospecting.ts's sendProspectTest. */
export async function sendBpoTestAction(args: {
  channel: 'sms' | 'email'
  subject?: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  return sendTemplateSelfTestAction({ channel: args.channel, subject: args.subject ?? null, body: args.body })
}
