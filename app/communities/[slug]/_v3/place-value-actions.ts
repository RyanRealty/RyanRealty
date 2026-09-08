'use server'

/**
 * The place-page value ask, server side (site queue SITE-01, Matt 2026-09-07).
 *
 * Two calls. `answerPlaceValue` is ungated: a typed address gets the place's verdict,
 * pace, cash share, and the comparable-close count, with no contact asked. It costs
 * database reads only (the comp ladder never calls lib/grok). `requestPlaceValuation`
 * is the win: email required, phone optional, and it does what the /sell form does,
 * CRM person, identity stitch, sequence, a CMA request under the place-page origin,
 * and a same-minute confirmation, which Matt classed as a system message.
 *
 * Both fail closed on the honeypot and the per-IP limiter, the way
 * app/actions/search-alert-capture.ts does.
 */

import { cookies, headers } from 'next/headers'
import { getAuthLimiter, getStrictLimiter } from '@/lib/rate-limit'
import { getCommunityBySlug } from '@/app/actions/communities'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { getPlaceValueAnswer } from '@/lib/data/places/getPlaceValueAnswer'
import { countCompsForAddress } from '@/lib/cma/place-comps'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { sendEvent } from '@/lib/crm/send-event'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'
import { isHardStopped } from '@/lib/canonical-lead-tagger'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { createCmaRequest } from '@/lib/cma-request'
import { sendPlaceValueConfirmation } from '@/lib/cma/request-emails'
import { resolveSigningBrokerForPerson } from '@/lib/data/cma/signing-broker'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import { buildAnswerFigures, salesPerMonthFrom } from '@/lib/site/answer-figures'
import { slugify } from '@/lib/slug'
import type {
  PlaceValueAnswerInput,
  PlaceValueAnswerResult,
  PlaceValueRequestInput,
  PlaceValueRequestResult,
} from '@/lib/site/place-value'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SITE_ORIGIN = 'https://ryan-realty.com'

type Place = { slug: string; name: string; city: string; geoSlug: string }

async function resolvePlace(rawSlug: string): Promise<Place | null> {
  const slug = rawSlug.trim().toLowerCase()
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null
  const community = await getCommunityBySlug(slug)
  if (!community) return null
  const name = getResortCommunityBySlug(slug)?.label ?? community.name
  return { slug, name, city: community.city, geoSlug: slug }
}

/**
 * Per-IP throttle. Fails closed in production when the limiter is unavailable.
 * The answer step runs the comp ladder (database reads) and a visitor retypes an
 * address a few times, so it gets the strict tier (10 a minute) on its own key
 * instead of sharing the 5-a-minute sign-in budget. The request step, which
 * writes to the CRM and the CMA queue, keeps the form tier.
 */
async function overLimit(key: string, tier: 'strict' | 'auth'): Promise<string | null> {
  const isProd = process.env.NODE_ENV === 'production'
  try {
    const limiter = tier === 'strict' ? getStrictLimiter() : getAuthLimiter()
    if (!limiter) return isProd ? 'Too many requests. Please try again later.' : null
    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || h.get('cf-connecting-ip') || '127.0.0.1'
    const { success } = await limiter.limit(`${key}:${ip}`)
    return success ? null : 'Too many requests. Please try again in a minute.'
  } catch {
    return isProd ? 'Too many requests. Please try again later.' : null
  }
}

function cleanAddress(raw: string): string | null {
  const address = raw.replace(/\s+/g, ' ').trim()
  if (address.length < 5 || address.length > 200) return null
  if (!/\d/.test(address)) return null
  return address
}

function streetOf(address: string): string {
  return address.split(',')[0]?.trim() || address
}

export async function answerPlaceValue(input: PlaceValueAnswerInput): Promise<PlaceValueAnswerResult> {
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: false, error: 'We could not read that address.' }
  }
  const limited = await overLimit('place-value-answer', 'strict')
  if (limited) return { ok: false, error: limited }

  const address = cleanAddress(String(input.address ?? ''))
  if (!address) return { ok: false, error: 'Start with the street number, like 123 Ranch House Lane.' }
  const place = await resolvePlace(String(input.slug ?? ''))
  if (!place) return { ok: false, error: 'That community page is not one we publish figures for.' }

  // The city answer is the pace rule's CONTEXT MARK: a community's days to
  // pending only means something beside the city it sits in. It is the same
  // cached DAL read every city page makes, one grain up.
  //
  // Except when the community IS its own town. Sunriver's `city` is "Sunriver",
  // so the city grain and the neighborhood grain name one place, and the rule
  // drew "Sunriver 31" as context for Sunriver's own 28 — two marks, one place,
  // read in the browser 2026-09-08. A context mark has to be somewhere else or
  // it is not context, so this place gets the rule with its one mark.
  const citySlug = slugify(place.city) === place.geoSlug ? null : slugify(place.city)
  const [answer, comps, cityAnswer] = await Promise.all([
    getPlaceValueAnswer({ geoType: 'neighborhood', geoSlug: place.geoSlug }).catch(() => null),
    countCompsForAddress({ rawAddress: address, city: place.city }).catch(() => null),
    citySlug
      ? getPlaceValueAnswer({ geoType: 'city', geoSlug: citySlug }).catch(() => null)
      : Promise.resolve(null),
  ])

  const verdict = answer?.verdict ?? null
  const mos = answer?.monthsOfSupply ?? null
  const dtp = answer?.daysToPending ?? null
  const cash = answer?.cashShare ?? null
  const compCount = comps?.subjectFound ? comps.count : null

  const headline =
    verdict && mos != null
      ? `${place.name} is a ${verdict.label} right now.`
      : `Here is what we can tell you about ${place.name} right now.`

  // THE PROSE IS ONLY WHAT THE DRAWINGS DO NOT SAY (site queue SITE-02b). The
  // supply, pace and comparable-sales sentences moved onto the figures as their
  // claims; keeping them here too made the answer say everything twice, which
  // is the wall of text TASTE.md bans. Cash share has no drawing, so it stays a
  // sentence.
  const body: string[] = []
  if (cash != null) body.push(`${(cash * 100).toFixed(0)}% of buyers here paid cash over the last year.`)
  if (!answer?.hasFigures) {
    body.unshift(
      `${place.name} has had fewer recent sales than a fair buyer's or seller's verdict needs, so we are not printing one. The written valuation carries the comparable sales.`,
    )
  }

  // THE DRAWINGS. One shaping for both address asks (lib/site/answer-figures),
  // so the community page and /sell draw the same three figures in the same
  // words. Each figure's source is the trace line getPlaceValueAnswer and the
  // comp ladder already wrote for that figure (§0) — this action never invents
  // one, and a figure whose source is missing is not drawn.
  const asOfLabel = answer?.asOf ? formatDate(answer.asOf) : null
  const supplyTrace = answer?.trace.find((line) => line.startsWith('months of supply')) ?? null
  const paceTrace = answer?.trace.find((line) => line.startsWith('days to pending')) ?? null
  const figures = buildAnswerFigures({
    placeLabel: place.name,
    street: streetOf(address),
    monthsOfSupply: mos != null ? formatMonthsOfSupply(mos) : null,
    verdictLabel: verdict?.label ?? null,
    activeCount: answer?.activeCount ?? null,
    salesPerMonth: salesPerMonthFrom(answer?.activeCount ?? null, mos),
    daysToPending: dtp,
    cityDaysToPending: citySlug ? (cityAnswer?.daysToPending ?? null) : null,
    cityLabel: citySlug ? place.city : null,
    compMarks: comps?.marks ?? [],
    compCount,
    subjectFound: Boolean(comps?.subjectFound),
    subjectSummary: comps?.subjectSummary ?? null,
    asOfLabel,
    sources: {
      supply: supplyTrace,
      pace: paceTrace,
      comps: comps?.trace ?? null,
    },
    unmatchedSentence: `Nothing in the sales record matches ${streetOf(address)} on the first pass.`,
  })

  const stamp = answer?.asOf ? `; updated ${formatDate(answer.asOf)}` : ''
  const source =
    `regional MLS through Oregon Data Share, read through the Market Truth metric layer: detached single-family homes assigned to ${place.name} by boundary membership; ` +
    `comparable sales from the Ryan Realty CMA engine${stamp}`

  return {
    ok: true,
    address,
    headline,
    body,
    figures,
    source,
    compCount,
    subjectFound: Boolean(comps?.subjectFound),
    verdictLabel: verdict?.label ?? null,
  }
}

export async function requestPlaceValuation(input: PlaceValueRequestInput): Promise<PlaceValueRequestResult> {
  // Honeypot: pretend success, do nothing.
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: true, brokerFirst: 'Matt', bookHref: '/book' }
  }
  const limited = await overLimit('place-value-request', 'auth')
  if (limited) return { ok: false, error: limited }

  const address = cleanAddress(String(input.address ?? ''))
  if (!address) return { ok: false, error: 'Start with the street number, like 123 Ranch House Lane.' }
  const email = String(input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'That email does not look complete.' }
  const phoneDigits = String(input.phone ?? '').replace(/\D/g, '')
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    return { ok: false, error: 'That phone number does not look complete.' }
  }
  const phone = phoneDigits ? (phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`) : null
  const place = await resolvePlace(String(input.slug ?? ''))
  if (!place) return { ok: false, error: 'That community page is not one we publish figures for.' }

  // Recompute what the page showed, server side, so the confirmation carries traced
  // figures and not whatever the client sent.
  const [answer, comps] = await Promise.all([
    getPlaceValueAnswer({ geoType: 'neighborhood', geoSlug: place.geoSlug }).catch(() => null),
    countCompsForAddress({ rawAddress: address, city: place.city }).catch(() => null),
  ])
  const compCount = comps?.subjectFound ? comps.count : null

  const attributed = await readAttributedAgentServer().catch(() => null)
  const brokerSlug = attributed?.broker ?? 'matt'
  const pageUrl = `${SITE_ORIGIN}/communities/${place.slug}`
  const tags = ['audience:seller', 'source:place-page', `place:${place.slug}`, `broker:${brokerSlug}`]

  let personId: number | null = null
  const eventResult = await sendEvent({
    type: 'Seller Inquiry',
    person: { emails: [{ value: email }], ...(phone ? { phones: [{ value: phone }] } : {}), tags },
    source: 'place-page',
    sourceUrl: pageUrl,
    pageUrl,
    pageTitle: `${place.name} homes for sale`,
    message: `Place page valuation. Address: ${address}. Place: ${place.name}. Verdict: ${answer?.verdict?.label ?? 'none published'}. Comparable sales: ${compCount ?? 'unmatched'}.`,
    property: { street: streetOf(address), city: place.city, state: 'OR' },
    brokerAttribution: { brokerSlug },
  }).catch((e: unknown) => ({ ok: false as const, error: String(e) }))
  if (eventResult.ok && eventResult.personId) personId = eventResult.personId
  if (!personId) {
    try {
      const native = await ensureNativeLead({ email, phone, source: 'place-page', assignedBroker: brokerSlug, tags })
      if (native.personId > 0) personId = native.personId
    } catch (e) {
      console.warn('[place-value] native fallback lead failed:', e)
    }
  }

  const hardStopped = personId ? await isHardStopped(personId).catch(() => false) : false

  if (personId) {
    const cookieStore = await cookies()
    const rrVid = cookieStore.get('rr_vid')?.value ?? null
    await stitchFormSubmitIdentity({
      personId,
      email,
      rrVid,
      sessionId: input.sessionId && UUID_V4_RE.test(input.sessionId) ? input.sessionId : null,
    }).catch((e: unknown) => console.warn('[place-value] identity stitch failed:', e))
  }

  if (personId && !hardStopped) {
    await enrichNativeLead({
      personId,
      tags,
      custom: {
        placeSlug: place.slug,
        placeName: place.name,
        placeVerdict: answer?.verdict?.label ?? null,
        placeCompCount: compCount,
        subjectAddress: address,
      },
      assignedBroker: brokerSlug,
      originNote: {
        title: 'Place page valuation request',
        body: `Typed ${address} on /communities/${place.slug} and asked for the written valuation. Saw: ${answer?.verdict?.label ?? 'no verdict'}, ${compCount ?? 'unmatched'} comparable sales.`,
      },
    }).catch((e: unknown) => console.warn('[place-value] enrich failed:', e))
    const { autoEnrollByPersonId } = await import('@/lib/crm/enroll')
    await autoEnrollByPersonId(personId, { smsConsent: false }).catch((e: unknown) =>
      console.warn('[place-value] auto-enroll failed:', e),
    )
  }

  const created = await createCmaRequest({
    rawAddress: address,
    parsedStreet: streetOf(address),
    parsedCity: place.city,
    parsedState: 'OR',
    parsedPostalCode: null,
    leadEmail: email,
    leadName: null,
    leadPhone: phone,
    leadTimeline: null,
    leadClassification: 'unknown',
    fubPersonId: personId,
    requestSource: 'place-page',
    notifyLead: false,
    notifyBroker: true,
    brokerSmsNotify: personId ? { personId, broker: brokerSlug } : null,
  })
  if (!created.ok) {
    console.warn('[place-value] createCmaRequest failed:', created.error)
    return { ok: false, error: 'That did not send. Check the connection and try again.' }
  }

  const signer = await resolveSigningBrokerForPerson(personId).catch(() => null)
  const brokerName = signer?.displayName ?? 'Matt Ryan'
  const brokerFirst = brokerName.split(/\s+/)[0] || 'Matt'
  const bookHref = `/book?agent=${encodeURIComponent(brokerSlug)}`
  const confirmation = await sendPlaceValueConfirmation({
    personId,
    brokerCrmSlug: signer?.crmSlug ?? brokerSlug,
    leadEmail: email,
    leadName: null,
    subjectAddress: address,
    placeName: place.name,
    verdictLabel: answer?.verdict?.label ?? null,
    monthsOfSupply: answer?.monthsOfSupply ?? null,
    daysToPending: answer?.daysToPending ?? null,
    cashShare: answer?.cashShare ?? null,
    compCount,
    asOfLabel: answer?.asOf ? formatDate(answer.asOf) : null,
    brokerName,
    bookHref: `${SITE_ORIGIN}${bookHref}`,
  }).catch((e: unknown) => ({ ok: false as const, via: 'failed' as const, error: String(e) }))
  if (!confirmation.ok) {
    // The page still says "on its way": the written valuation is, through the CMA queue.
    // The same-minute summary is what did not go, and the log says why.
    console.warn(`[place-value] confirmation not sent (${confirmation.via}): ${confirmation.error ?? 'no detail'} — cma ${created.slug}`)
  } else {
    console.log(`[place-value] confirmation sent via ${confirmation.via} — cma ${created.slug}`)
  }

  try {
    const cookieStore = await cookies()
    void fireGa4Event({
      eventName: 'generate_lead',
      clientId: readGa4ClientIdFromCookies(cookieStore) ?? undefined,
      eventParams: {
        lp_variant: 'place-page',
        place_slug: place.slug,
        broker_slug: brokerSlug,
        lead_type: 'seller',
        value: 500,
        currency: 'USD',
      },
      userProperties: { assigned_broker: brokerSlug },
    })
  } catch (e) {
    console.warn('[place-value] GA4 MP fire prep failed:', e)
  }

  return { ok: true, brokerFirst, bookHref }
}
