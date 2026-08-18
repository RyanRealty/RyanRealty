import { NextRequest, NextResponse, after } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sendEvent } from '@/lib/crm/send-event'
import { createCmaRequest } from '@/lib/cma-request'
import { getMetaPageToken } from '@/lib/meta-env'
import { fireGa4Event } from '@/lib/ga4-measurement-protocol'
import { normalizeAgentSlug, brokerSlugFromText, FUB_USER_ID_BY_BROKER, type BrokerSlug } from '@/lib/agent-attribution'
import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { recordMarketingAssignment } from '@/lib/data/crm/recordMarketingAssignment'

export const runtime = 'nodejs'

/**
 * POST /api/meta/lead-webhook
 *
 * Receives Facebook Lead Ads webhooks and creates/updates contacts in the
 * in-house CRM (crm_people) for lead nurture. FUB was decommissioned
 * 2026-06-24 — the old FUB /events + /people push paths were dead no-ops (the
 * missing key made getFubConfig throw, silently dropping every webhook lead
 * before even the native fallback could run) and were replaced with the
 * native capture chain: sendEvent (ensureNativeLead) → enrichNativeLead
 * (tags + custom fields + origin note) → createNativeTask (hot leads).
 *
 * Meta sends a POST for each new lead. This handler:
 *   1. Verifies the X-Hub-Signature-256 HMAC against META_APP_SECRET.
 *   2. For each leadgen change in the payload:
 *      a. Fetches lead details from the Meta Graph API.
 *      b. Maps field_data to structured contact fields.
 *      c. Creates/updates the person in crm_people with canonical tags.
 *      d. Writes an origin note with campaign context and lead intent.
 *   3. Returns 200 immediately (Meta requires < 20s response; errors are logged
 *      but not propagated to avoid Meta retry storms).
 *
 * GET /api/meta/lead-webhook
 *
 * Meta sends a GET with hub.challenge during initial webhook subscription.
 * This handler echoes the challenge back to verify the endpoint.
 *
 * Required env vars:
 *   META_APP_SECRET          — from Meta App Dashboard → App Settings → Basic
 *   META_PAGE_ACCESS_TOKEN   — long-lived page token (also META_PAGE_TOKEN)
 *
 * Setup (one-time, in Meta App Dashboard):
 *   App Dashboard → Webhooks → Page → Subscribe to "leadgen" field.
 *   Callback URL: https://ryanrealty.vercel.app/api/meta/lead-webhook
 *   Verify Token: any string you set (checked in the GET handler).
 *
 * See: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0'

// Default assigned-user ledger id for inbound leads. Meta calls us
// server-to-server (no browser cookie), so ?agent= attribution can't be
// resolved in the webhook — route all FB-form leads to Matt, matching the
// "all leads to Matt" default used by the LP paths. Manual reassignment in
// the CRM still works per-lead.
const FUB_USER_MATT = 1

function getMetaToken(): string {
  // Prefer the System User token (has `leads_retrieval` scope so we can
  // fetch field_data for each inbound Lead Ad). Fall back to the Page token
  // — which can receive webhooks but CANNOT read individual lead payloads,
  // so falling back means downstream FUB persons get no email/phone/timeline.
  const token = (process.env.META_USER_ACCESS_TOKEN || getMetaPageToken() || '').trim()
  if (!token) throw new Error('META_USER_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN not configured')
  return token
}

// Service-role Supabase client for processed_meta_leads dedup writes.
// Created at module load — the credentials are stable env vars.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
    if (isProd) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    return null
  }
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

function verifySignature(body: string, signatureHeader: string | null): boolean {
  const appSecret = (process.env.META_APP_SECRET || '').trim()
  if (!appSecret) {
    // Fail CLOSED everywhere, not just in prod. The old dev-allow branch meant a
    // preview/staging deploy missing the secret accepted ANY forged leadgen POST
    // (fake contacts, poisoned attribution). A webhook receiver that cannot
    // verify a signature must reject — set META_APP_SECRET to test locally.
    console.error('[lead-webhook] META_APP_SECRET not set — rejecting (fail closed)')
    return false
  }

  if (!signatureHeader) {
    console.error('[lead-webhook] Missing X-Hub-Signature-256 header')
    return false
  }

  // Header format: "sha256=<hex>"
  const [algo, hexSig] = signatureHeader.split('=')
  if (algo !== 'sha256' || !hexSig) {
    console.error('[lead-webhook] Invalid signature header format:', signatureHeader)
    return false
  }

  const expected = createHmac('sha256', appSecret).update(body, 'utf8').digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(hexSig, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Meta types
// ---------------------------------------------------------------------------

interface LeadFieldData {
  name: string
  values: string[]
}

interface MetaLeadDetail {
  id: string
  created_time: string
  ad_id?: string
  ad_name?: string
  adset_id?: string
  adset_name?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
  field_data?: LeadFieldData[]
}

interface WebhookEntry {
  id: string
  time: number
  changes: Array<{
    field: string
    value: {
      leadgen_id?: string
      ad_id?: string
      ad_name?: string
      adset_id?: string
      adset_name?: string
      campaign_id?: string
      campaign_name?: string
      form_id?: string
      page_id?: string
    }
  }>
}

interface WebhookPayload {
  object?: string
  entry?: WebhookEntry[]
}

// ---------------------------------------------------------------------------
// Fetch lead details from Meta Graph API
// ---------------------------------------------------------------------------

async function fetchLeadDetails(leadId: string): Promise<MetaLeadDetail | null> {
  const token = getMetaToken()
  const fields = 'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data'
  const url = `${META_GRAPH_BASE}/${leadId}?fields=${fields}&access_token=${encodeURIComponent(token)}`

  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    console.error(`[lead-webhook] Network error fetching lead ${leadId}:`, err)
    return null
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[lead-webhook] Meta API error for lead ${leadId} (HTTP ${res.status}): ${body}`)
    return null
  }

  const data = await res.json() as MetaLeadDetail
  return data
}

// ---------------------------------------------------------------------------
// Parse field_data into a contact record
// ---------------------------------------------------------------------------

type LeadAudience = 'buyer' | 'seller' | 'unknown'
type LeadIntent = 'hot' | 'warm' | 'nurture' | null

interface ParsedLead {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  buySellIntent: string | null
  timelineAnswer: string | null
  propertyAddress: string | null
  audience: LeadAudience
  intent: LeadIntent
  possibleRealtor: boolean
  campaignName: string | null
  adSetName: string | null
  leadId: string
  createdTime: string
  /** Per-broker routing from a hidden `assigned_broker` form field (else null → Matt). */
  assignedBroker: BrokerSlug | null
}

const TIMELINE_FIELD_HINTS = [
  'timeline',
  'when',
  'how_soon',
  'time_frame',
  'timeframe',
  'thinking',
  'looking_to_buy',
  'looking_to_sell',
  'planning_to_sell',
  'planning_to_buy',
  'ready_to_sell',
  'ready_to_buy',
]

function getTimelineAnswer(fields: LeadFieldData[]): string | null {
  for (const f of fields) {
    const key = f.name.toLowerCase()
    if (TIMELINE_FIELD_HINTS.some(h => key.includes(h))) {
      const v = f.values?.[0]?.trim()
      if (v) return v
    }
  }
  return null
}

// A property address is the one custom field a seller lead form adds beyond the
// prefilled name/email/phone — it's what the CMA producer needs. Match address-like
// custom questions, but never the email field.
const ADDRESS_FIELD_HINTS = [
  'street_address',
  'property_address',
  'home_address',
  'your_address',
  'address',
  'property',
  'street',
]

function getPropertyAddress(fields: LeadFieldData[]): string | null {
  for (const f of fields) {
    const key = f.name.toLowerCase()
    if (key.includes('email')) continue
    if (ADDRESS_FIELD_HINTS.some(h => key.includes(h))) {
      const v = f.values?.[0]?.trim()
      if (v) return v
    }
  }
  return null
}

function classifyIntent(answer: string | null): LeadIntent {
  if (!answer) return null
  const a = answer.toLowerCase()
  if (
    a.includes('asap') ||
    a.includes('immediately') ||
    a.includes('right now') ||
    /\bnow\b/.test(a) ||
    a.includes('this month') ||
    a.includes('0-3') ||
    a.includes('0 to 3') ||
    a.includes('within 3')
  ) return 'hot'
  if (
    a.includes('this year') ||
    a.includes('next 3') ||
    a.includes('next 6') ||
    a.includes('3-12') ||
    a.includes('3 to 12') ||
    a.includes('within 12') ||
    a.includes('soon') ||
    a.includes('few months')
  ) return 'warm'
  if (
    a.includes('explor') ||
    a.includes('research') ||
    a.includes('just') ||
    a.includes('curious') ||
    a.includes('12+') ||
    a.includes('more than 12') ||
    a.includes('next year') ||
    a.includes('not sure') ||
    a.includes('eventually')
  ) return 'nurture'
  return null
}

function detectAudience(lead: MetaLeadDetail, intentField: string | null): LeadAudience {
  const campaign = (lead.campaign_name || '').toLowerCase()
  if (campaign.includes('buyer') || campaign.includes('listing alert')) return 'buyer'
  if (campaign.includes('seller') || campaign.includes('home value')) return 'seller'
  const form = (lead.form_id || '').toLowerCase()
  if (form && intentField) {
    const i = intentField.toLowerCase()
    if (i.includes('buy')) return 'buyer'
    if (i.includes('sell')) return 'seller'
  }
  return 'unknown'
}

const REALTOR_KEYWORDS = [
  'realtor', 'real estate', 'realty', 'agent', 'broker',
  'kw.com', 'kellerwilliams', 'remax', 're/max', 'century21',
  'sothebys', 'sotheby', 'compass.com', 'coldwell', 'cbre',
  'berkshirehathaway', 'exp realty', 'expworld', 'windermere',
  'johnlscott', 'redfin.com',
]

function detectPossibleRealtor(firstName: string | null, lastName: string | null, email: string | null): boolean {
  const blob = [firstName, lastName, email].filter(Boolean).join(' ').toLowerCase()
  if (!blob) return false
  return REALTOR_KEYWORDS.some(kw => blob.includes(kw))
}

function parseLeadFields(lead: MetaLeadDetail): ParsedLead {
  const fields = lead.field_data || []

  function get(name: string): string | null {
    const f = fields.find(f => f.name.toLowerCase() === name.toLowerCase())
    return f?.values?.[0]?.trim() || null
  }

  const firstName = get('first_name')
  const lastName = get('last_name')
  const email = get('email')
  const buySellIntent = get('buy_sell_intent')
  const timelineAnswer = getTimelineAnswer(fields)

  return {
    firstName,
    lastName,
    email,
    phone: get('phone_number') || get('phone'),
    buySellIntent,
    timelineAnswer,
    propertyAddress: getPropertyAddress(fields),
    audience: detectAudience(lead, buySellIntent),
    intent: classifyIntent(timelineAnswer),
    possibleRealtor: detectPossibleRealtor(firstName, lastName, email),
    campaignName: lead.campaign_name || null,
    adSetName: lead.adset_name || null,
    leadId: lead.id,
    createdTime: lead.created_time,
    // Hidden per-broker field on the lead form (e.g. assigned_broker=rebecca).
    // Lets a broker's FB lead ad route the lead to them — the webhook is
    // server-to-server so the ?agent= cookie isn't available here.
    assignedBroker: normalizeAgentSlug(get('assigned_broker')),
  }
}

// ---------------------------------------------------------------------------
// Create/update person in the native CRM
// ---------------------------------------------------------------------------

/** Canonical tag set for an FB lead-ad capture (same schema the LP paths use). */
function buildLeadTags(lead: ParsedLead, brokerSlug: BrokerSlug): string[] {
  const tags = ['FB Lead Ad']
  if (lead.audience === 'buyer') tags.push('audience:buyer')
  else if (lead.audience === 'seller') tags.push('audience:seller')

  if (lead.buySellIntent === 'buying') tags.push('Intent: Buying')
  else if (lead.buySellIntent === 'selling') tags.push('Intent: Selling')
  else if (lead.buySellIntent === 'both') tags.push('Intent: Buying + Selling')
  else if (lead.buySellIntent === 'exploring') tags.push('Intent: Exploring')

  // Canonical kebab-case namespaced tier tags (FUB-era cadence research;
  // see docs/archive/fub-era/README.md):
  //   seller:hot, seller:warm, seller:nurture
  //   buyer:hot, buyer:warm, buyer:nurture
  if (lead.possibleRealtor) {
    tags.push('possible-realtor')
  } else if (lead.intent === 'hot') {
    tags.push(lead.audience === 'buyer' ? 'buyer:hot' : 'seller:hot')
  } else if (lead.intent === 'warm') {
    tags.push(lead.audience === 'buyer' ? 'buyer:warm' : 'seller:warm')
  } else if (lead.intent === 'nurture') {
    tags.push(lead.audience === 'buyer' ? 'buyer:nurture' : 'seller:nurture')
  }

  // Source attribution in canonical schema (in addition to the source field
  // which carries the campaign name)
  tags.push(lead.audience === 'buyer' ? 'source:fb-ads-buyer' : 'source:fb-ads-seller')
  tags.push(`broker:${brokerSlug}`)
  return tags
}

/**
 * Capture the FB lead in crm_people (sendEvent → ensureNativeLead, deduped
 * email-first) and enrich it with the canonical tag set, the campaign custom
 * fields, and the lead-origin note. Returns the native crm_people id, or null
 * when no usable contact key existed (caller runs the ensureNativeLead
 * fallback, which also records assignment ledger context).
 */
async function createLeadContact(lead: ParsedLead, brokerSlug: BrokerSlug): Promise<number | null> {
  const source = lead.campaignName
    ? `Facebook Lead Ad — ${lead.campaignName}`
    : 'Facebook Lead Ad — Market Report'

  const eventType = lead.audience === 'seller' ? 'Seller Inquiry' : 'General Inquiry'
  const campaignAttribution = lead.campaignName
    ? {
        source: 'Facebook',
        campaign: lead.campaignName,
        ...(lead.adSetName && { content: lead.adSetName }),
      }
    : { source: 'Facebook' }

  const messageParts = [
    lead.campaignName ? `Campaign: ${lead.campaignName}` : 'Facebook Lead Ad',
    lead.audience !== 'unknown' ? `Audience: ${lead.audience}` : null,
    lead.buySellIntent ? `Intent: ${lead.buySellIntent}` : null,
  ].filter(Boolean)

  const eventResult = await sendEvent({
    type: eventType,
    source,
    system: 'Facebook Lead Ad',
    person: {
      ...(lead.firstName && { firstName: lead.firstName }),
      ...(lead.lastName && { lastName: lead.lastName }),
      ...(lead.email && { emails: [{ value: lead.email }] }),
      ...(lead.phone && { phones: [{ value: lead.phone }] }),
    },
    message: messageParts.join(' | '),
    campaign: campaignAttribution,
    brokerAttribution: { brokerSlug },
  })

  if (!eventResult.ok) {
    console.warn(`[lead-webhook] native capture failed: ${eventResult.error ?? eventResult.status ?? 'unknown'}`)
    return null
  }
  if (!eventResult.personId) {
    console.warn(
      `[lead-webhook] native capture resolved no person id (email=${lead.email ?? 'none'}, phone=${lead.phone ?? 'none'})`,
    )
    return null
  }
  const personId = eventResult.personId

  // Enrichment in one native write: the canonical tag set (sendEvent only
  // stamps audience:/source: defaults), the campaign custom fields, and the
  // lead-origin note (replaces the dead FUB setPersonCustomFields /
  // updatePersonAutomationState / notes-POST chain).
  const noteBody = [
    `Facebook Lead Ad capture`,
    `Lead ID: ${lead.leadId}`,
    `Captured: ${new Date(lead.createdTime).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`,
    lead.campaignName ? `Campaign: ${lead.campaignName}` : null,
    lead.adSetName ? `Ad Set: ${lead.adSetName}` : null,
    lead.audience !== 'unknown' ? `Audience: ${lead.audience}` : null,
    lead.timelineAnswer ? `Timeline answer: ${lead.timelineAnswer}` : null,
    lead.intent ? `Classified intent: ${lead.intent}` : null,
    lead.possibleRealtor ? `Possible realtor — auto-tagged for review` : null,
    lead.buySellIntent ? `Buy/sell field: ${lead.buySellIntent}` : null,
    `---`,
    `Source: Facebook Lead Generation Ad`,
  ].filter(Boolean).join('\n')

  await enrichNativeLead({
    personId,
    tags: buildLeadTags(lead, brokerSlug),
    custom: {
      ...(lead.buySellIntent ? { buySellIntent: lead.buySellIntent } : {}),
      ...(lead.campaignName ? { fbCampaignName: lead.campaignName } : {}),
    },
    assignedBroker: brokerSlug,
    originNote: { title: 'Facebook Lead Ad capture', body: noteBody },
  })

  return personId
}

// ---------------------------------------------------------------------------
// Process a single lead
// ---------------------------------------------------------------------------

async function processLead(leadId: string, adName?: string): Promise<void> {
  console.log(`[lead-webhook] Processing lead: ${leadId} (ad: ${adName || 'unknown'})`)

  // Dedup check — Meta retries on 5xx and network errors. Insert into
  // processed_meta_leads (PRIMARY KEY on leadgen_id) to no-op duplicates.
  // Without this, duplicate webhook fires create duplicate FUB persons + notes + tasks.
  const supabase = getSupabase()
  if (supabase) {
    const { error: dedupError } = await supabase
      .from('processed_meta_leads')
      .insert({ leadgen_id: leadId, status: 'processing', ad_name: adName ?? null })

    if (dedupError) {
      // PostgreSQL unique_violation = already processed — short-circuit safely.
      if (dedupError.code === '23505') {
        console.log(`[lead-webhook] Lead ${leadId} already processed — skipping duplicate webhook delivery`)
        return
      }
      // Other DB errors: log but continue — don't block lead processing on DB issues.
      console.error(`[lead-webhook] dedup insert failed (continuing):`, dedupError)
    }
  }

  // Fetch full lead details from Meta
  const leadDetail = await fetchLeadDetails(leadId)
  if (!leadDetail) {
    console.error(`[lead-webhook] Could not fetch lead details for ${leadId} — skipping`)
    return
  }

  const parsed = parseLeadFields(leadDetail)
  console.log(`[lead-webhook] Lead fields — name: ${parsed.firstName} ${parsed.lastName}, email: ${parsed.email}, intent: ${parsed.buySellIntent}`)

  // Per-broker routing, in order of reliability: an explicit hidden
  // `assigned_broker` form field, else the broker's name in the campaign/ad-set
  // name (e.g. "Seller Leads — Rebecca" — the practical lever since Meta Instant
  // Forms have no true hidden field), else Matt. Used by both the native fallback
  // and the FUB assignment below.
  const brokerSlug: BrokerSlug =
    parsed.assignedBroker ??
    brokerSlugFromText(`${parsed.campaignName ?? ''} ${parsed.adSetName ?? ''}`) ??
    'matt'
  const brokerFubUserId = FUB_USER_ID_BY_BROKER[brokerSlug] ?? FUB_USER_MATT

  if (!parsed.email && !parsed.phone) {
    console.warn(`[lead-webhook] Lead ${leadId} has no email or phone — capture will skip (no dedup key)`)
  }

  // Create/reuse the native CRM contact (deduped email-first).
  const personId = await createLeadContact(parsed, brokerSlug)
  if (!personId) {
    // Native capture could not resolve a person — run the direct
    // ensureNativeLead fallback so an FB-ad lead is NEVER orphaned. Routes to
    // the per-broker slug, records the assignment ledger, then finishes (the
    // person-keyed steps below can't run without a person id).
    console.error(`[lead-webhook] person creation failed for lead ${leadId}. Native fallback`)
    try {
      const native = await ensureNativeLead({
        name: [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || null,
        email: parsed.email,
        phone: parsed.phone,
        source: 'meta-lead-form',
        assignedBroker: brokerSlug,
        tags: ['source:meta-lead-form', `audience:${parsed.audience}`, `broker:${brokerSlug}`, 'fub-fallback'],
      })
      console.warn(
        `[lead-webhook] native fallback lead ${native.created ? 'created' : 'reused'} crm person ${native.personId} (broker ${brokerSlug})`,
      )
      if (native.personId > 0) {
        // Upsert on (person, audience, source) — F8; a Meta 5xx retry of the same
        // leadgen_id now refreshes one row instead of stacking. Also carries the
        // resolved ids: it sent fub_person_id AND fub_user_id null before, and
        // fub_user_id is NOT NULL, so the fallback row never actually landed.
        const assignRes = await recordMarketingAssignment({
          audience: parsed.audience === 'buyer' ? 'buyer' : 'seller',
          broker: brokerSlug,
          fubUserId: brokerFubUserId,
          fubPersonId: native.personId,
          source: 'meta-lead-form',
          tier: parsed.intent === 'hot' || parsed.intent === 'warm' ? parsed.intent : 'nurture',
        })
        if (!assignRes.ok) console.warn('[lead-webhook] native ledger upsert failed:', assignRes.error)
      }
    } catch (e) {
      console.error('[lead-webhook] native fallback failed:', e)
    }
    return
  }

  // Broker assignment already landed natively: sendEvent carried the
  // brokerAttribution into ensureNativeLead and enrichNativeLead re-stamped
  // assigned_broker (covers the reuse path). Record the assignment ledger row
  // for the audit trail like the seller-LP path.
  console.log(`[lead-webhook] Person ${personId} assigned to broker ${brokerSlug}`)
  // Upsert, not insert (F8): a repeat ad lead refreshes the one ledger row.
  const assignRes = await recordMarketingAssignment({
    audience: parsed.audience === 'buyer' ? 'buyer' : 'seller',
    broker: brokerSlug,
    fubUserId: brokerFubUserId,
    fubPersonId: personId,
    source: 'meta-lead-form',
    tier: parsed.intent === 'hot' || parsed.intent === 'warm' ? parsed.intent : 'nurture',
  })
  if (!assignRes.ok) console.warn('[lead-webhook] marketing_assignments upsert failed:', assignRes.error)

  // (Context note already written natively by createLeadContact's
  // enrichNativeLead originNote.)

  // Instant auto-enroll for buyer leads. The buyer LP enrolls inline, but FB
  // instant-form leads were only picked up by the 15-min catch-all cron, so the
  // first automated email landed 15-30 min late. Speed-to-first-touch is the #1
  // conversion lever on a lead-form ad, so mirror the LP path: enroll now into
  // the email-first buyer sequence (plan 70, selected by the audience:buyer tag).
  // SMS stays FAIL-CLOSED — an FB instant form captures no SMS consent, so
  // smsConsent:false suppresses the sms step and only the email touch fires until
  // the lead opts in. Realtors skipped. Dedupe-safe: the cron hits the same key
  // and no-ops. Non-blocking so it never delays the 200 webhook ack.
  if (parsed.audience === 'buyer' && !parsed.possibleRealtor) {
    void import('@/lib/crm/enroll')
      .then(({ autoEnrollByFubId }) => autoEnrollByFubId(personId, { smsConsent: false }))
      .catch((e) => console.warn('[lead-webhook] buyer auto-enroll failed (non-blocking):', e))
  }

  // Seller lead that included a property address → kick off the CMA pipeline,
  // exactly like the website LP path (createCmaRequest → cmas row + content:cma
  // brain action → CMA producer builds the 15-page CMA + a Gmail draft for Matt).
  // Skip realtors and leads with no usable contact.
  if (parsed.audience === 'seller' && parsed.propertyAddress && parsed.email && !parsed.possibleRealtor) {
    try {
      const cma = await createCmaRequest({
        rawAddress: parsed.propertyAddress,
        parsedStreet: null,
        parsedCity: null,
        parsedState: null,
        parsedPostalCode: null,
        leadEmail: parsed.email,
        leadName: [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || null,
        leadPhone: parsed.phone,
        leadTimeline: parsed.timelineAnswer,
        leadClassification: parsed.intent,
        fubPersonId: personId,
      })
      console.log(
        `[lead-webhook] CMA request ${cma.ok ? `queued (${cma.slug})` : `FAILED: ${cma.error}`} for person ${personId}`,
      )
    } catch (e) {
      console.error('[lead-webhook] createCmaRequest threw (continuing):', e)
    }
  }

  // Geocode + geo-tag seller property addresses, same as the website LP path.
  // Without this, paid Meta seller leads carry audience/source tags but no
  // city:* / neighborhood:* / subdivision:* tags, so they are invisible to the
  // geo-filtered FUB smart lists brokers route follow-up from until the 30-min
  // delta cron eventually picks them up.
  if (parsed.audience === 'seller' && parsed.propertyAddress && !parsed.possibleRealtor) {
    void import('@/lib/lead-geocode')
      .then(({ geocodeAndTagLead }) =>
        geocodeAndTagLead({ fubPersonId: personId, address: parsed.propertyAddress as string, sourceType: 'property' }),
      )
      .catch((e) => console.warn('[lead-webhook] geocode failed (non-blocking):', e))
  }

  // Fire 5-min native task for hot leads (skip realtors) — replaces the dead
  // FUB createRealtimeTask with the crm_tasks equivalent the LP paths use.
  if (parsed.intent === 'hot' && !parsed.possibleRealtor) {
    const who = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || parsed.email || 'unknown'
    const label = parsed.audience === 'buyer' ? 'Hot buyer' : 'Hot seller'
    await createNativeTask({
      personId,
      name: `${label} lead — call within 5 min: ${who}`,
      type: 'Call',
      dueInMinutes: 5,
      assignedBroker: brokerSlug,
    })
    console.log(`[lead-webhook] Hot-lead 5-min task created for person ${personId}`)
  }

  // GA4 Measurement Protocol mirror — fire generate_lead server-side.
  // Webhook context has no browser cookies (Meta calls us directly), so the
  // client_id is a fresh uuid. The event still counts toward the
  // generate_lead conversion and carries the campaign attribution.
  void fireGa4Event({
    eventName: 'generate_lead',
    eventParams: {
      lp_variant: 'meta-leadgen-form',
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      lp_campaign: parsed.campaignName ?? undefined,
      lp_content: parsed.adSetName ?? undefined,
      lead_classification: parsed.intent ?? undefined,
      lead_type: parsed.audience === 'buyer' ? 'buyer' : parsed.audience === 'seller' ? 'seller' : undefined,
      fub_person_id: personId,
      meta_lead_id: parsed.leadId,
      possible_realtor: parsed.possibleRealtor,
    },
  }).catch((e) => console.warn('[lead-webhook] GA4 event failed:', e))

  console.log(`[lead-webhook] Lead ${leadId} → crm person ${personId} (${parsed.email || 'no email'}) intent=${parsed.intent ?? 'n/a'} audience=${parsed.audience} realtor=${parsed.possibleRealtor}`)

  // Mark dedup row complete with FUB person ID + classification context.
  if (supabase) {
    await supabase
      .from('processed_meta_leads')
      .update({
        status: 'completed',
        fub_person_id: personId,
        campaign_name: parsed.campaignName,
        audience: parsed.audience,
        intent: parsed.intent ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq('leadgen_id', leadId)
  }
}

// ---------------------------------------------------------------------------
// GET — webhook verification (Meta hub.challenge)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const challenge = url.searchParams.get('hub.challenge')
  const verifyToken = url.searchParams.get('hub.verify_token')

  if (mode === 'subscribe' && challenge) {
    // Optional: verify the token if META_WEBHOOK_VERIFY_TOKEN is set
    const expectedToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim()
    if (expectedToken && verifyToken !== expectedToken) {
      console.error('[lead-webhook] Webhook verify token mismatch')
      return new NextResponse('Forbidden', { status: 403 })
    }

    console.log('[lead-webhook] Webhook verification challenge received — responding')
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ ok: true, status: 'lead-webhook endpoint live' })
}

// ---------------------------------------------------------------------------
// POST — receive lead events
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read the raw body for signature verification BEFORE parsing JSON
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    console.error('[lead-webhook] Failed to read request body')
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Verify signature
  const sigHeader = req.headers.get('x-hub-signature-256')
  if (!verifySignature(rawBody, sigHeader)) {
    console.error('[lead-webhook] Signature verification failed')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Parse payload
  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    console.error('[lead-webhook] Invalid JSON payload')
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Meta requires a fast 200 response — process AFTER responding. `after()`
  // (next/server) keeps the work alive past the flushed response on Vercel;
  // a bare fire-and-forget IIFE can be frozen/recycled once the response ships,
  // silently dropping a paid FB/IG lead (CRM contact + CMA + hot-lead task).
  after(async () => {
    try {
      const entries = payload.entry || []
      for (const entry of entries) {
        const changes = entry.changes || []
        for (const change of changes) {
          if (change.field !== 'leadgen') continue

          const leadId = change.value.leadgen_id
          if (!leadId) {
            console.warn('[lead-webhook] leadgen change missing leadgen_id:', change)
            continue
          }

          await processLead(leadId, change.value.ad_name)
        }
      }
    } catch (err) {
      console.error('[lead-webhook] Unhandled error during async processing:', err)
    }
  })

  // Return 200 immediately so Meta doesn't retry
  return NextResponse.json({ ok: true })
}
