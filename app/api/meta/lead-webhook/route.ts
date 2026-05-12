import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createRealtimeTask } from '@/lib/followupboss'

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

function getMetaToken(): string {
  // Prefer the System User token (has `leads_retrieval` scope so we can
  // fetch field_data for each inbound Lead Ad). Fall back to the Page token
  // — which can receive webhooks but CANNOT read individual lead payloads,
  // so falling back means downstream FUB persons get no email/phone/timeline.
  const token = (
    process.env.META_USER_ACCESS_TOKEN ||
    process.env.META_PAGE_ACCESS_TOKEN ||
    process.env.META_PAGE_TOKEN ||
    ''
  ).trim()
  if (!token) throw new Error('META_USER_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN not configured')
  return token
}

function getFubConfig(): { apiKey: string; pipelineId: string | null } {
  const apiKey = (
    process.env.FUB_API_KEY ||
    process.env.FOLLOWUPBOSS_API_KEY ||
    ''
  ).trim()
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
    console.warn('[lead-webhook] META_APP_SECRET not set — skipping signature verification (INSECURE)')
    return true // warn and proceed in dev; in production set META_APP_SECRET
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
  audience: LeadAudience
  intent: LeadIntent
  possibleRealtor: boolean
  campaignName: string | null
  adSetName: string | null
  leadId: string
  createdTime: string
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
    audience: detectAudience(lead, buySellIntent),
    intent: classifyIntent(timelineAnswer),
    possibleRealtor: detectPossibleRealtor(firstName, lastName, email),
    campaignName: lead.campaign_name || null,
    adSetName: lead.adset_name || null,
    leadId: lead.id,
    createdTime: lead.created_time,
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

  if (lead.possibleRealtor) {
    tags.push('possible-realtor')
  } else if (lead.intent === 'hot') {
    tags.push(lead.audience === 'buyer' ? 'hot-buyer' : 'hot-seller')
    if (lead.audience !== 'buyer') tags.push('auto:seller-seq:new')
  } else if (lead.intent === 'warm') {
    tags.push(lead.audience === 'buyer' ? 'warm-buyer' : 'warm-seller')
  } else if (lead.intent === 'nurture') {
    tags.push('nurture-only')
  }

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

  // Fetch full lead details from Meta
  const leadDetail = await fetchLeadDetails(leadId)
  if (!leadDetail) {
    console.error(`[lead-webhook] Could not fetch lead details for ${leadId} — skipping`)
    return
  }

  const parsed = parseLeadFields(leadDetail)
  console.log(`[lead-webhook] Lead fields — name: ${parsed.firstName} ${parsed.lastName}, email: ${parsed.email}, intent: ${parsed.buySellIntent}`)

  if (!parsed.email && !parsed.phone) {
    console.warn(`[lead-webhook] Lead ${leadId} has no email or phone — creating FUB contact anyway (name-only record)`)
  }

  // Create FUB contact
  const personId = await createFubContact(parsed)
  if (!personId) {
    console.error(`[lead-webhook] FUB person creation failed for lead ${leadId}`)
    return
  }

  // Add context note
  await addFubNote(personId, parsed)

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

  console.log(`[lead-webhook] Lead ${leadId} → FUB person ${personId} (${parsed.email || 'no email'}) intent=${parsed.intent ?? 'n/a'} audience=${parsed.audience} realtor=${parsed.possibleRealtor}`)
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
