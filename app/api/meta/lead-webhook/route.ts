import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  assignPersonToUser,
  createRealtimeTask,
  sendEvent,
  findPersonByEmail,
  findPersonByPhone,
  setPersonCustomFields,
  updatePersonAutomationState,
} from '@/lib/followupboss'
import { createCmaRequest } from '@/lib/cma-request'
import { getFubApiKey } from '@/lib/crm/fub-env'
import { getMetaPageToken } from '@/lib/meta-env'
import { fireGa4Event } from '@/lib/ga4-measurement-protocol'
import { normalizeAgentSlug, brokerSlugFromText, FUB_USER_ID_BY_BROKER, type BrokerSlug } from '@/lib/agent-attribution'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'

export const runtime = 'nodejs'

/**
 * POST /api/meta/lead-webhook
 *
 * Receives Facebook Lead Ads webhooks and creates/updates contacts in
 * Follow-Up Boss (FUB) for lead nurture.
 *
 * Meta sends a POST for each new lead. This handler:
 *   1. Verifies the X-Hub-Signature-256 HMAC against META_APP_SECRET.
 *   2. For each leadgen change in the payload:
 *      a. Fetches lead details from the Meta Graph API.
 *      b. Maps field_data to structured contact fields.
 *      c. Creates/updates the person in FUB via POST /v1/people.
 *      d. Adds a note with campaign context and lead intent.
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
 *   FUB_API_KEY              — FUB API key (also FOLLOWUPBOSS_API_KEY)
 *   FUB_PIPELINE_ID          — FUB pipeline ID for new leads (optional but recommended)
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
const FUB_BASE = 'https://api.followupboss.com/v1'

// Default FUB user for inbound leads. Meta calls us server-to-server (no browser
// cookie), so agent attribution can't be resolved in the webhook — route all
// FB-form leads to Matt (userId 1), matching the "all leads to Matt" default
// used by the LP paths (lib/canonical-lead-tagger, seller-home-value). Manual
// reassignment in the FUB UI still works per-lead.
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

function getFubConfig(): { apiKey: string; pipelineId: string | null } {
  const apiKey = (getFubApiKey() || '').trim()
  if (!apiKey) throw new Error('FUB_API_KEY not configured')
  const pipelineId = (process.env.FUB_PIPELINE_ID || '').trim() || null
  return { apiKey, pipelineId }
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
// Create/update person in FUB
// ---------------------------------------------------------------------------

function fubHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  }
  const system = (process.env.FOLLOWUPBOSS_SYSTEM || '').trim()
  const systemKey = (process.env.FOLLOWUPBOSS_SYSTEM_KEY || '').trim()
  if (system) headers['X-System'] = system
  if (systemKey) headers['X-System-Key'] = systemKey
  return headers
}

async function createFubContact(lead: ParsedLead): Promise<number | null> {
  const { apiKey, pipelineId } = getFubConfig()

  // ---------------------------------------------------------------------------
  // Shared: compute source, tags, and intent values (identical for both paths)
  // ---------------------------------------------------------------------------

  const source = lead.campaignName
    ? `Facebook Lead Ad — ${lead.campaignName}`
    : 'Facebook Lead Ad — Market Report'

  const tags = ['FB Lead Ad']
  if (lead.audience === 'buyer') tags.push('audience:buyer')
  else if (lead.audience === 'seller') tags.push('audience:seller')

  if (lead.buySellIntent === 'buying') tags.push('Intent: Buying')
  else if (lead.buySellIntent === 'selling') tags.push('Intent: Selling')
  else if (lead.buySellIntent === 'both') tags.push('Intent: Buying + Selling')
  else if (lead.buySellIntent === 'exploring') tags.push('Intent: Exploring')

  // Canonical kebab-case namespaced tier tags per
  // docs/FUB_SELLER_WORKFLOW_2026-05-17.md §4. Replaces legacy hot-buyer /
  // warm-seller / auto:seller-seq:new / nurture-only with canonical:
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

  // Source attribution in canonical schema (in addition to FUB-native source
  // field which carries the campaign name)
  tags.push(lead.audience === 'buyer' ? 'source:fb-ads-buyer' : 'source:fb-ads-seller')

  // ---------------------------------------------------------------------------
  // PRIMARY PATH: POST /v1/events (fires action plans + speed-to-lead auto-text)
  // ---------------------------------------------------------------------------

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
      tags,
    },
    message: messageParts.join(' | '),
    campaign: campaignAttribution,
  })

  if (eventResult.ok) {
    // Resolve the personId created/matched by /events
    let personId: number | null = null
    if (lead.email) {
      const found = await findPersonByEmail(lead.email)
      if (found?.id) personId = found.id
    }
    if (!personId && lead.phone) {
      const found = await findPersonByPhone(lead.phone)
      if (found?.id) personId = found.id
    }

    if (personId) {
      // Apply custom fields (/events cannot set these inline).
      // Only pass keys that start with 'custom' — setPersonCustomFields enforces this.
      const customFields: Record<string, string | null> = {}
      if (lead.buySellIntent) customFields.customBuySellIntent = lead.buySellIntent
      if (lead.campaignName) customFields.customFbCampaignName = lead.campaignName
      if (Object.keys(customFields).length > 0) {
        void setPersonCustomFields(personId, customFields)
      }

      // Set stage 'Lead' and pipeline (if configured) via updatePersonAutomationState.
      // Pipeline is a non-standard field for this helper, so we set stage here and
      // use updatePersonProfile for pipeline below if pipelineId is present.
      await updatePersonAutomationState({ personId, stage: 'Lead' })

      // Mirror the new/matched person into crm_people
      const { mirrorPersonFromFub } = await import('@/lib/crm/mirror')
      void mirrorPersonFromFub(personId)

      return personId
    }

    // /events succeeded but we could not resolve a personId — fall through to
    // the /people fallback so the lead is never lost.
    console.warn(
      '[lead-webhook] /events succeeded but personId could not be resolved ' +
      `(email=${lead.email ?? 'none'}, phone=${lead.phone ?? 'none'}) — falling back to /people`,
    )
  } else {
    console.warn(
      `[lead-webhook] /events path failed (status=${eventResult.status ?? 'n/a'}, ` +
      `error=${eventResult.error ?? 'unknown'}) — falling back to /people`,
    )
  }

  // ---------------------------------------------------------------------------
  // FALLBACK PATH: POST /v1/people (original path — preserved verbatim)
  // ---------------------------------------------------------------------------

  const body: Record<string, unknown> = {
    source,
    tags,
    stage: 'Lead',
    ...(lead.firstName && { firstName: lead.firstName }),
    ...(lead.lastName && { lastName: lead.lastName }),
    ...(lead.email && { emails: [{ value: lead.email, type: 'Primary' }] }),
    ...(lead.phone && { phones: [{ value: lead.phone, type: 'Mobile' }] }),
    // Custom fields
    ...(lead.buySellIntent && { buySellIntent: lead.buySellIntent }),
    ...(lead.campaignName && { campaign: lead.campaignName }),
  }

  if (pipelineId) {
    body.pipeline = pipelineId
  }

  let res: Response
  try {
    res = await fetch(`${FUB_BASE}/people`, {
      method: 'POST',
      headers: fubHeaders(apiKey),
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[lead-webhook] FUB network error creating person:', err)
    return null
  }

  let data: Record<string, unknown>
  try {
    data = await res.json() as Record<string, unknown>
  } catch {
    console.error(`[lead-webhook] FUB non-JSON response (HTTP ${res.status})`)
    return null
  }

  if (!res.ok) {
    const msg = (data.error as Record<string, string>)?.message || JSON.stringify(data)
    console.error(`[lead-webhook] FUB createPerson failed (HTTP ${res.status}): ${msg}`)
    return null
  }

  const personId = (data.id || (data.person as Record<string, unknown>)?.id) as number | undefined
  if (personId) {
    // Dual-write: mirror the new person into crm_people (parallel-run, blueprint §7)
    const { mirrorPersonFromFub } = await import('@/lib/crm/mirror')
    void mirrorPersonFromFub(personId)
  }
  return personId ?? null
}

async function addFubNote(personId: number, lead: ParsedLead): Promise<void> {
  const { apiKey } = getFubConfig()

  const lines = [
    `Facebook Lead Ad capture`,
    `Lead ID: ${lead.leadId}`,
    `Captured: ${new Date(lead.createdTime).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`,
    lead.campaignName ? `Campaign: ${lead.campaignName}` : null,
    lead.adSetName ? `Ad Set: ${lead.adSetName}` : null,
    lead.audience !== 'unknown' ? `Audience: ${lead.audience}` : null,
    lead.timelineAnswer ? `Timeline answer: ${lead.timelineAnswer}` : null,
    lead.intent ? `Classified intent: ${lead.intent}` : null,
    lead.possibleRealtor ? `⚠ Possible realtor — auto-tagged for review` : null,
    lead.buySellIntent ? `Buy/sell field: ${lead.buySellIntent}` : null,
    `---`,
    `Source: Facebook Lead Generation Ad`,
  ].filter(Boolean).join('\n')

  try {
    await fetch(`${FUB_BASE}/notes`, {
      method: 'POST',
      headers: fubHeaders(apiKey),
      body: JSON.stringify({ personId, body: lines, isHtml: false }),
    })
  } catch (err) {
    console.warn('[lead-webhook] FUB addNote error (non-fatal):', err)
  }
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
    console.warn(`[lead-webhook] Lead ${leadId} has no email or phone — creating FUB contact anyway (name-only record)`)
  }

  // Create FUB contact
  const personId = await createFubContact(parsed)
  if (!personId) {
    // FUB person creation failed — capture the lead natively so an FB-ad lead is
    // NEVER orphaned on a FUB outage/cutover (was: silently dropped). Routes to
    // the per-broker slug, records the assignment ledger, then finishes (the
    // FUB-dependent steps below can't run without a FUB person id).
    console.error(`[lead-webhook] FUB person creation failed for lead ${leadId}; native fallback`)
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
      if (supabase && (native.created || native.personId > 0)) {
        await supabase
          .from('marketing_assignments')
          .insert({
            audience: parsed.audience === 'buyer' ? 'buyer' : 'seller',
            broker: brokerSlug,
            fub_user_id: null,
            fub_person_id: null,
            source: 'meta-lead-form',
            tier: parsed.intent === 'hot' || parsed.intent === 'warm' ? parsed.intent : 'nurture',
          })
          .then(({ error }) => {
            if (error) console.warn('[lead-webhook] native marketing_assignments insert failed:', error.message)
          })
      }
    } catch (e) {
      console.error('[lead-webhook] native fallback failed:', e)
    }
    return
  }

  // Assign the person to a FUB user so the lead is not left unassigned/invisible
  // (FB-form leads were landing with no owner). Meta calls us server-to-server
  // with no browser cookie, so the ?agent= cookie isn't available — instead we
  // route by the hidden `assigned_broker` form field (brokerSlug, default Matt),
  // then record the assignment for the audit trail like the seller-LP path.
  const assigned = await assignPersonToUser(personId, brokerFubUserId)
  console.log(`[lead-webhook] Person ${personId} assigned to FUB user ${brokerFubUserId} (${brokerSlug}): ${assigned}`)
  if (supabase) {
    const { error: assignErr } = await supabase.from('marketing_assignments').insert({
      audience: parsed.audience === 'buyer' ? 'buyer' : 'seller',
      broker: brokerSlug,
      fub_user_id: brokerFubUserId,
      fub_person_id: personId,
      source: 'meta-lead-form',
      tier: parsed.intent === 'hot' || parsed.intent === 'warm' ? parsed.intent : 'nurture',
    })
    if (assignErr) console.warn('[lead-webhook] marketing_assignments insert failed:', assignErr.message)
  }

  // Add context note
  await addFubNote(personId, parsed)

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

  // Fire 5-min realtime task for hot leads (skip realtors)
  if (parsed.intent === 'hot' && !parsed.possibleRealtor) {
    const who = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || parsed.email || 'unknown'
    const label = parsed.audience === 'buyer' ? 'Hot buyer' : 'Hot seller'
    const taskOk = await createRealtimeTask({
      personId,
      taskName: `${label} lead — call within 5 min: ${who}`,
      taskType: 'Call',
      dueInMinutes: 5,
    })
    console.log(`[lead-webhook] Hot-lead 5-min task ${taskOk ? 'created' : 'NOT created'} for person ${personId}`)
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

  console.log(`[lead-webhook] Lead ${leadId} → FUB person ${personId} (${parsed.email || 'no email'}) intent=${parsed.intent ?? 'n/a'} audience=${parsed.audience} realtor=${parsed.possibleRealtor}`)

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

  // Meta requires a fast 200 response — process async, return immediately
  // We respond 200 first, then process. This prevents Meta retry storms.

  // Fire-and-forget processing (errors are caught internally)
  void (async () => {
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
  })()

  // Return 200 immediately so Meta doesn't retry
  return NextResponse.json({ ok: true })
}
