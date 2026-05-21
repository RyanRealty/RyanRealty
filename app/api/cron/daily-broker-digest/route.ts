/**
 * Daily new-leads digest for each Ryan Realty broker.
 *
 * Schedule: 0 15 * * *  (15:00 UTC = 08:00 PT during DST, 07:00 PT in winter).
 *
 * For each active broker in `public.brokers`:
 *   1. Resolve their FUB user id (env map or email lookup).
 *   2. Pull every FUB person assigned to them whose `created` falls in the
 *      last 24 hours.
 *   3. Send one email summarizing all those new leads. Subject:
 *      "Your new leads today YYYY-MM-DD".
 *
 * Brand voice §4.7: sentence case, no em-dashes, no banned cliches, direct.
 * Auth: Bearer $CRON_SECRET.
 *
 * Manual invocation: GET /api/cron/daily-broker-digest?dryRun=true
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { DailyDigestEmail, type DailyLead } from '@/lib/digest-email-templates'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const FUB_BASE = 'https://api.followupboss.com/v1'

type Broker = {
  slug: string
  email: string
  displayName: string
  firstName: string
}

type FubUser = { id: number; email?: string; name?: string }
type FubPerson = {
  id?: number
  name?: string
  firstName?: string
  lastName?: string
  emails?: Array<{ value?: string | null }>
  phones?: Array<{ value?: string | null }>
  tags?: string[] | null
  source?: string | null
  created?: string | null
  assignedUserId?: number | null
  addresses?: Array<{ street?: string | null; city?: string | null; state?: string | null }> | null
  lastActivity?: string | null
  customAddress?: string | null
  customPropertyAddress?: string | null
}

function fubHeaders(): HeadersInit {
  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY || '').trim()
  if (!apiKey) throw new Error('FOLLOWUPBOSS_API_KEY not set')
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

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function parseBrokerUserMap(): Record<string, number> {
  const raw = process.env.FOLLOWUPBOSS_BROKER_USER_MAP?.trim()
  if (!raw) return {}
  const map: Record<string, number> = {}
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split(':')
    const key = (k ?? '').trim().toLowerCase()
    const value = Number((v ?? '').trim())
    if (key && Number.isFinite(value) && value > 0) map[key] = value
  }
  return map
}

async function findFubUserByEmail(email: string): Promise<FubUser | null> {
  const q = new URLSearchParams({ email: email.trim(), limit: '1', fields: 'id,email,name' })
  const res = await fetch(`${FUB_BASE}/users?${q}`, { headers: fubHeaders(), cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as { users?: FubUser[] } | null
  return Array.isArray(data?.users) && data!.users.length > 0 ? data!.users[0] : null
}

async function resolveFubUserId(broker: Broker): Promise<number | null> {
  const map = parseBrokerUserMap()
  const fromMap = map[broker.slug.toLowerCase()] ?? map[broker.email.toLowerCase()]
  if (fromMap) return fromMap
  const user = await findFubUserByEmail(broker.email)
  return user?.id ?? null
}

async function fetchNewLeadsForUser(
  assignedUserId: number,
  sinceIso: string,
): Promise<FubPerson[]> {
  // FUB People API supports `assignedUserId` filter and `createdAfter`.
  const pageSize = 100
  const all: FubPerson[] = []
  for (let offset = 0; offset < 1000; offset += pageSize) {
    const q = new URLSearchParams({
      assignedUserId: String(assignedUserId),
      createdAfter: sinceIso,
      sort: '-created',
      limit: String(pageSize),
      offset: String(offset),
      fields:
        'id,name,firstName,lastName,emails,phones,tags,source,created,assignedUserId,addresses,lastActivity',
    })
    const res = await fetch(`${FUB_BASE}/people?${q.toString()}`, {
      headers: fubHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) break
    const data = (await res.json().catch(() => null)) as { people?: FubPerson[] } | null
    const people = Array.isArray(data?.people) ? data!.people : []
    if (people.length === 0) break
    all.push(...people)
    if (people.length < pageSize) break
  }
  return all
}

function classifyAudience(tags: string[] | null | undefined): 'seller' | 'buyer' | 'unknown' {
  if (!Array.isArray(tags)) return 'unknown'
  const lower = tags.map((t) => t.toLowerCase())
  if (lower.includes('audience:seller')) return 'seller'
  if (lower.includes('audience:buyer')) return 'buyer'
  // Fallback heuristic: stock FUB tags
  if (lower.includes('seller')) return 'seller'
  if (lower.includes('buyer')) return 'buyer'
  return 'unknown'
}

function buildName(person: FubPerson): string {
  if (person.name?.trim()) return person.name.trim()
  const fn = person.firstName?.trim() ?? ''
  const ln = person.lastName?.trim() ?? ''
  const joined = [fn, ln].filter(Boolean).join(' ').trim()
  if (joined) return joined
  const email = person.emails?.[0]?.value?.trim()
  return email || `FUB Contact ${person.id ?? 'unknown'}`
}

function buildAddressLine(person: FubPerson): string | null {
  if (!Array.isArray(person.addresses) || person.addresses.length === 0) return null
  const a = person.addresses[0]
  const parts = [a.street, a.city, a.state].map((s) => (s ?? '').trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function buildFubUrl(personId: number): string {
  const base = process.env.FOLLOWUPBOSS_APP_URL?.trim() || 'https://app.followupboss.com'
  return `${base}/2/people/view/${personId}`
}

function mapPerson(person: FubPerson): DailyLead | null {
  const id = Number(person.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    fubPersonId: id,
    name: buildName(person),
    email: person.emails?.[0]?.value?.trim() || null,
    phone: person.phones?.[0]?.value?.trim() || null,
    source: typeof person.source === 'string' && person.source.trim() ? person.source.trim() : null,
    audience: classifyAudience(person.tags),
    lastActivityIso: person.lastActivity?.trim() || person.created?.trim() || null,
    addressLine: buildAddressLine(person),
    fubUrl: buildFubUrl(id),
  }
}

async function loadBrokers(): Promise<Broker[]> {
  const supabase = getServiceSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('brokers')
    .select('slug, display_name, email, is_active')
    .eq('is_active', true)
    .order('sort_order')
  if (error || !Array.isArray(data)) return []
  return data
    .filter((b) => b.email?.includes('@'))
    .map((b) => {
      const firstName = (b.display_name || '').split(/\s+/)[0] || 'there'
      return {
        slug: String(b.slug),
        email: String(b.email),
        displayName: String(b.display_name || b.slug),
        firstName,
      }
    })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const onlyBroker = url.searchParams.get('broker')?.trim().toLowerCase() || null

  const fromEnv = process.env.RESEND_FROM?.trim() || 'Matt Ryan <matt@ryan-realty.com>'
  const asOfDate = new Date().toISOString().slice(0, 10)
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const brokers = await loadBrokers()
  if (brokers.length === 0) {
    return NextResponse.json({ ok: false, error: 'no active brokers' }, { status: 200 })
  }

  const results: Array<{
    broker: string
    fubUserId: number | null
    leadsFound: number
    emailed: boolean
    emailId?: string
    error?: string
  }> = []

  for (const broker of brokers) {
    if (onlyBroker && broker.slug.toLowerCase() !== onlyBroker) continue

    let fubUserId: number | null = null
    let leads: DailyLead[] = []
    try {
      fubUserId = await resolveFubUserId(broker)
      if (!fubUserId) {
        results.push({ broker: broker.slug, fubUserId: null, leadsFound: 0, emailed: false, error: 'no fub user id' })
        continue
      }
      const persons = await fetchNewLeadsForUser(fubUserId, sinceIso)
      leads = persons.map(mapPerson).filter((l): l is DailyLead => l !== null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ broker: broker.slug, fubUserId, leadsFound: 0, emailed: false, error: msg })
      continue
    }

    if (dryRun) {
      results.push({ broker: broker.slug, fubUserId, leadsFound: leads.length, emailed: false })
      continue
    }

    const subject = `Your new leads today, ${asOfDate}`
    const sent = await sendEmail({
      to: broker.email,
      from: fromEnv,
      subject,
      replyTo: 'matt@ryan-realty.com',
      react: DailyDigestEmail({
        brokerFirstName: broker.firstName,
        asOfDate,
        leads,
      }),
    })

    if (sent.error) {
      results.push({ broker: broker.slug, fubUserId, leadsFound: leads.length, emailed: false, error: sent.error })
    } else {
      results.push({ broker: broker.slug, fubUserId, leadsFound: leads.length, emailed: true, emailId: sent.id })
    }
  }

  return NextResponse.json({
    ok: true,
    asOfDate,
    sinceIso,
    dryRun,
    results,
  })
}
