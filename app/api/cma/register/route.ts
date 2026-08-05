/**
 * /api/cma/register — the CMA web page's registration + consent endpoint
 * (Matt 2026-08-05: the CMA page is the Google sign-on door; only the lead
 * the doc was built for gets access; capture SMS/email consent there).
 *
 * GET  ?slug=…&start=1  → begins Google OAuth with return to /cma/[slug].
 * POST slug, smsOptIn?, emailOptIn? → records the viewer's registration on
 * the linked person (claim for phone-only leads, consent choices, an audited
 * timeline row carrying the exact wording version) and returns to the doc.
 *
 * Consent is never a condition of viewing (TCPA): the POST succeeds with both
 * boxes unchecked and the report opens either way.
 */
import { NextResponse } from 'next/server'
import { getSession, getSignInUrl } from '@/app/actions/auth'
import { getCmaAccessIdentity } from '@/lib/data'
import { decideCmaAccess } from '@/lib/cma/register-gate'
import { SMS_CONSENT_TEXT } from '@/lib/crm/sms-consent-text'
import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 0

const SLUG_RE = /^[a-z0-9-]{3,80}$/

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = String(url.searchParams.get('slug') ?? '').trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const res = await getSignInUrl('google', `/cma/${slug}`)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.redirect(res.url)
}

export async function POST(request: Request) {
  const form = await request.formData()
  const slug = String(form.get('slug') ?? '').trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const session = await getSession()
  const viewerEmail = session?.user?.email?.trim().toLowerCase()
  if (!viewerEmail) return NextResponse.redirect(new URL(`/cma/${slug}`, request.url))

  const identity = await getCmaAccessIdentity(slug)
  if (!identity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const decision = decideCmaAccess({
    isAdmin: false,
    viewerEmail,
    clientEmail: identity.clientEmail,
    personEmails: identity.personEmails,
    claimedBy: identity.claimedBy,
    consentRecorded: false,
  })
  if (decision.kind === 'wrong-person') {
    return NextResponse.redirect(new URL(`/cma/${slug}`, request.url))
  }

  const smsOptIn = form.get('smsOptIn') === '1'
  const emailOptIn = form.get('emailOptIn') === '1'

  if (identity.personId) {
    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id, custom, emails')
      .eq('id', identity.personId)
      .maybeSingle()
    if (person) {
      const custom = { ...((person.custom as Record<string, unknown>) ?? {}) }
      custom.cmaConsent = {
        sms: smsOptIn,
        email: emailOptIn,
        at: new Date().toISOString(),
        slug,
        viewer: viewerEmail,
        consentVersion: 'a2p-2026-06',
      }
      // Bind-on-first-register for phone-only leads (no email anywhere on
      // file): the claimer's email becomes the doc's identity AND a contact
      // point, so later visits email-match normally.
      const claiming = decision.kind === 'claim-and-consent'
      if (claiming) custom.cmaClaimedBy = viewerEmail
      const emails = ((person.emails as Array<{ value?: string }> | null) ?? []).slice()
      if (claiming && !emails.some((e) => String(e?.value ?? '').trim().toLowerCase() === viewerEmail)) {
        emails.push({ value: viewerEmail, type: 'Registered', isPrimary: emails.length === 0 ? 1 : 0 } as {
          value: string
        })
      }
      await sb
        .from('crm_people')
        .update({ custom, emails, updated_at: new Date().toISOString() })
        .eq('id', identity.personId)

      // Audited consent row — first writer wins per (person, slug).
      await sb.from('crm_timeline').insert({
        person_id: identity.personId,
        kind: 'system',
        title: `CMA page registered by ${viewerEmail}`,
        body: smsOptIn
          ? `SMS consent captured at registration. Wording: ${SMS_CONSENT_TEXT}`
          : `Registered to view /cma/${slug}. SMS consent: declined. Email updates: ${emailOptIn ? 'yes' : 'no'}.`,
        payload: { slug, smsOptIn, emailOptIn, viewerEmail, consentVersion: 'a2p-2026-06' },
        dedupe_key: `cma-register:${slug}:${identity.personId}`,
      })
    }
  }

  return NextResponse.redirect(new URL(`/cma/${slug}`, request.url), 303)
}
