/**
 * Live environment probes for G13 unknown-health integrations.
 * Read-only: models/account/search/HTML. No generate, no send, no spend.
 *
 *   npx tsx scripts/loop-probe-g13-live.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

type Probe = {
  id: string
  system: string
  envPresent: string[]
  envMissing: string[]
  httpStatus: number | null
  ok: boolean
  evidence: string
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function maskId(value: string | undefined, keep = 8): string {
  const v = value?.trim() ?? ''
  if (!v) return '(missing)'
  if (v.length <= keep) return `${v.slice(0, 2)}…`
  return `${v.slice(0, keep)}…`
}

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    /* keep text */
  }
  return { status: res.status, body, text: text.slice(0, 240) }
}

async function probeOpenAI(): Promise<Probe> {
  const key = process.env.OPENAI_API_KEY?.trim()
  const envPresent = key ? ['OPENAI_API_KEY'] : []
  const envMissing = key ? [] : ['OPENAI_API_KEY']
  if (!key) {
    return {
      id: 'INT-021',
      system: 'OpenAI',
      envPresent,
      envMissing,
      httpStatus: null,
      ok: false,
      evidence: 'OPENAI_API_KEY missing in this environment',
    }
  }
  const { status, body } = await getJson('https://api.openai.com/v1/models', {
    Authorization: `Bearer ${key}`,
  })
  const data = body as { data?: Array<{ id?: string }> }
  const n = Array.isArray(data.data) ? data.data.length : 0
  const sample = data.data?.[0]?.id ?? 'none'
  return {
    id: 'INT-021',
    system: 'OpenAI',
    envPresent,
    envMissing,
    httpStatus: status,
    ok: status === 200 && n > 0,
    evidence: `GET /v1/models HTTP ${status}; models=${n}; sample=${sample}`,
  }
}

async function probeXai(): Promise<Probe> {
  const key = process.env.XAI_API_KEY?.trim()
  const envPresent = key ? ['XAI_API_KEY'] : []
  const envMissing = key ? [] : ['XAI_API_KEY']
  if (!key) {
    return {
      id: 'INT-023',
      system: 'xAI',
      envPresent,
      envMissing,
      httpStatus: null,
      ok: false,
      evidence: 'XAI_API_KEY missing in this environment',
    }
  }
  const { status, body } = await getJson('https://api.x.ai/v1/models', {
    Authorization: `Bearer ${key}`,
  })
  const data = body as { data?: Array<{ id?: string }> }
  const n = Array.isArray(data.data) ? data.data.length : 0
  const sample = data.data?.[0]?.id ?? 'none'
  return {
    id: 'INT-023',
    system: 'xAI',
    envPresent,
    envMissing,
    httpStatus: status,
    ok: status === 200 && n > 0,
    evidence: `GET /v1/models HTTP ${status}; models=${n}; sample=${sample}`,
  }
}

async function probeSentry(): Promise<Probe> {
  const dsn = process.env.SENTRY_DSN?.trim()
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  const envPresent = [
    dsn ? 'SENTRY_DSN' : '',
    token ? 'SENTRY_AUTH_TOKEN' : '',
  ].filter(Boolean)
  const envMissing = [
    dsn ? '' : 'SENTRY_DSN',
    token ? '' : 'SENTRY_AUTH_TOKEN',
  ].filter(Boolean)
  if (!token) {
    return {
      id: 'INT-026',
      system: 'Sentry',
      envPresent,
      envMissing,
      httpStatus: null,
      ok: false,
      evidence: `DSN ${dsn ? 'present' : 'missing'}; SENTRY_AUTH_TOKEN missing — cannot confirm ingest`,
    }
  }
  const org = await getJson('https://sentry.io/api/0/organizations/', {
    Authorization: `Bearer ${token}`,
  })
  const orgs = Array.isArray(org.body) ? (org.body as Array<{ slug?: string }>) : []
  const slug = orgs[0]?.slug
  let events = 'skipped'
  let eventStatus: number | null = null
  if (slug) {
    const ev = await getJson(
      `https://sentry.io/api/0/organizations/${slug}/stats_v2/?field=sum(quantity)&category=error&interval=1d&statsPeriod=14d`,
      { Authorization: `Bearer ${token}` },
    )
    eventStatus = ev.status
    const groups = (ev.body as { groups?: unknown[] })?.groups
    events = `stats_v2 HTTP ${ev.status}; groups=${Array.isArray(groups) ? groups.length : 0}`
  }
  const dsnOk = Boolean(dsn && /^https:\/\//.test(dsn))
  return {
    id: 'INT-026',
    system: 'Sentry',
    envPresent,
    envMissing,
    httpStatus: org.status,
    ok: org.status === 200 && dsnOk,
    evidence: `orgs HTTP ${org.status} n=${orgs.length} slug=${slug ?? 'none'}; DSN ${dsnOk ? 'present' : 'missing'}; ${events}`,
  }
}

async function probeNeverBounce(): Promise<Probe> {
  const key = process.env.NEVERBOUNCE_API_KEY?.trim()
  const envPresent = key ? ['NEVERBOUNCE_API_KEY'] : []
  const envMissing = key ? [] : ['NEVERBOUNCE_API_KEY']
  if (!key) {
    return {
      id: 'INT-029',
      system: 'NeverBounce',
      envPresent,
      envMissing,
      httpStatus: null,
      ok: false,
      evidence: 'NEVERBOUNCE_API_KEY missing — ops script only, no product path',
    }
  }
  const { status, body } = await getJson(
    `https://api.neverbounce.com/v4/account/info?key=${encodeURIComponent(key)}`,
    {},
  )
  const info = body as { status?: string; credits_info?: { paid_credits_remaining?: number } }
  return {
    id: 'INT-029',
    system: 'NeverBounce',
    envPresent,
    envMissing,
    httpStatus: status,
    ok: status === 200 && info.status === 'success',
    evidence: `GET /v4/account/info HTTP ${status}; status=${info.status ?? 'n/a'}; paid_credits_remaining=${info.credits_info?.paid_credits_remaining ?? 'n/a'}`,
  }
}

async function probeStock(): Promise<Probe> {
  const pexels = process.env.PEXELS_API_KEY?.trim()
  const unsplash = process.env.UNSPLASH_ACCESS_KEY?.trim()
  const shutter = process.env.SHUTTERSTOCK_API_KEY?.trim()
  const shutterSecret = process.env.SHUTTERSTOCK_API_SECRET?.trim()
  const envPresent = [
    pexels ? 'PEXELS_API_KEY' : '',
    unsplash ? 'UNSPLASH_ACCESS_KEY' : '',
    shutter ? 'SHUTTERSTOCK_API_KEY' : '',
    shutterSecret ? 'SHUTTERSTOCK_API_SECRET' : '',
  ].filter(Boolean)
  const envMissing = [
    pexels ? '' : 'PEXELS_API_KEY',
    unsplash ? '' : 'UNSPLASH_ACCESS_KEY',
    shutter ? '' : 'SHUTTERSTOCK_API_KEY',
  ].filter(Boolean)

  const bits: string[] = []
  let anyOk = false
  let lastStatus: number | null = null

  if (pexels) {
    const r = await getJson('https://api.pexels.com/v1/search?query=bend%20oregon&per_page=1', {
      Authorization: pexels,
    })
    lastStatus = r.status
    const n = (r.body as { photos?: unknown[] }).photos?.length ?? 0
    const ok = r.status === 200 && n > 0
    anyOk = anyOk || ok
    bits.push(`pexels HTTP ${r.status} photos=${n}`)
  } else bits.push('pexels missing')

  if (unsplash) {
    const r = await getJson('https://api.unsplash.com/search/photos?query=bend%20oregon&per_page=1', {
      Authorization: `Client-ID ${unsplash}`,
    })
    lastStatus = r.status
    const n = (r.body as { results?: unknown[] }).results?.length ?? 0
    const ok = r.status === 200 && n > 0
    anyOk = anyOk || ok
    bits.push(`unsplash HTTP ${r.status} results=${n}`)
  } else bits.push('unsplash missing')

  if (shutter && shutterSecret) {
    const basic = Buffer.from(`${shutter}:${shutterSecret}`).toString('base64')
    const r = await getJson('https://api.shutterstock.com/v2/images/search?query=bend%20oregon&per_page=1', {
      Authorization: `Basic ${basic}`,
    })
    lastStatus = r.status
    const n = (r.body as { data?: unknown[] }).data?.length ?? 0
    const ok = r.status === 200 && n > 0
    anyOk = anyOk || ok
    bits.push(`shutterstock HTTP ${r.status} data=${n}`)
  } else bits.push('shutterstock missing')

  return {
    id: 'INT-031',
    system: 'Stock media',
    envPresent,
    envMissing,
    httpStatus: lastStatus,
    ok: anyOk,
    evidence: bits.join('; '),
  }
}

async function probeGen(): Promise<Probe> {
  const replicate = process.env.REPLICATE_API_TOKEN?.trim()
  const fal = process.env.FAL_KEY?.trim()
  const synthesia = process.env.SYNTHESIA_API_KEY?.trim()
  const envPresent = [
    replicate ? 'REPLICATE_API_TOKEN' : '',
    fal ? 'FAL_KEY' : '',
    synthesia ? 'SYNTHESIA_API_KEY' : '',
  ].filter(Boolean)
  const envMissing = [
    replicate ? '' : 'REPLICATE_API_TOKEN',
    fal ? '' : 'FAL_KEY',
    synthesia ? '' : 'SYNTHESIA_API_KEY',
  ].filter(Boolean)

  const bits: string[] = []
  let anyOk = false
  let lastStatus: number | null = null

  if (replicate) {
    const r = await getJson('https://api.replicate.com/v1/account', {
      Authorization: `Bearer ${replicate}`,
    })
    lastStatus = r.status
    const username = (r.body as { username?: string }).username
    const ok = r.status === 200 && Boolean(username)
    anyOk = anyOk || ok
    bits.push(`replicate HTTP ${r.status} username=${username ?? 'n/a'}`)
  } else bits.push('replicate missing')

  if (fal) {
    const r = await getJson('https://rest.alpha.fal.ai/models?limit=1', {
      Authorization: `Key ${fal}`,
    })
    lastStatus = r.status
    const ok = r.status === 200
    anyOk = anyOk || ok
    bits.push(`fal HTTP ${r.status}`)
  } else bits.push('fal missing')

  if (synthesia) {
    const r = await getJson('https://api.synthesia.io/v2/videos?limit=1', {
      Authorization: synthesia,
    })
    lastStatus = r.status
    const n = (r.body as { videos?: unknown[] }).videos?.length ?? 0
    const ok = r.status === 200
    anyOk = anyOk || ok
    bits.push(`synthesia HTTP ${r.status} videos=${n}`)
  } else bits.push('synthesia missing')

  return {
    id: 'INT-032',
    system: 'Gen media',
    envPresent,
    envMissing,
    httpStatus: lastStatus,
    ok: anyOk,
    evidence: bits.join('; '),
  }
}

async function probeVapid(): Promise<Probe> {
  const pub =
    process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  const envPresent = [
    process.env.VAPID_PUBLIC_KEY?.trim() ? 'VAPID_PUBLIC_KEY' : '',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ? 'NEXT_PUBLIC_VAPID_PUBLIC_KEY' : '',
    priv ? 'VAPID_PRIVATE_KEY' : '',
    subject ? 'VAPID_SUBJECT' : '',
  ].filter(Boolean)
  const envMissing = [
    pub ? '' : 'VAPID_PUBLIC_KEY',
    priv ? '' : 'VAPID_PRIVATE_KEY',
    subject ? '' : 'VAPID_SUBJECT',
  ].filter(Boolean)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let subs = -1
  let active = -1
  if (url && key) {
    const sb = createClient(url, key)
    const all = await sb.from('push_subscriptions').select('id', { count: 'exact', head: true })
    const live = await sb
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .is('disabled_at', null)
    subs = all.count ?? -1
    active = live.count ?? -1
  }

  const keysOk = Boolean(pub && priv)
  return {
    id: 'INT-033',
    system: 'VAPID',
    envPresent,
    envMissing,
    httpStatus: null,
    ok: keysOk,
    evidence: `keys ${keysOk ? 'present' : 'missing'}; subject=${subject ?? 'missing'}; push_subscriptions=${subs} active=${active}; no send`,
  }
}

async function probeAdSense(): Promise<Probe> {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()
  const envPresent = client ? ['NEXT_PUBLIC_ADSENSE_CLIENT_ID'] : []
  const envMissing = client ? [] : ['NEXT_PUBLIC_ADSENSE_CLIENT_ID']
  const pages = [
    'https://ryan-realty.com/',
    'https://ryan-realty.com/homes-for-sale',
    'https://ryan-realty.com/housing-market/bend',
  ]
  const bits: string[] = [`client ${client ? maskId(client, 10) : 'missing'}`]
  let anyHit = false
  let lastStatus: number | null = null
  for (const page of pages) {
    const res = await fetch(page, {
      headers: { 'User-Agent': 'RyanRealty-G13-probe/1.0' },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    })
    lastStatus = res.status
    const html = await res.text()
    const hasScript = html.includes('adsbygoogle') || html.includes('pagead2.googlesyndication.com')
    const hasClient = client ? html.includes(client) : false
    const hasSlot = html.includes('data-ad-client') || html.includes('adsbygoogle')
    anyHit = anyHit || (res.status === 200 && (hasScript || hasClient || hasSlot))
    bits.push(`${new URL(page).pathname || '/'} HTTP ${res.status} script=${hasScript} client=${hasClient}`)
  }
  return {
    id: 'INT-036',
    system: 'AdSense',
    envPresent,
    envMissing,
    httpStatus: lastStatus,
    ok: Boolean(client) && anyHit,
    evidence: bits.join('; '),
  }
}

async function main() {
  const probes = await Promise.all([
    probeOpenAI(),
    probeXai(),
    probeSentry(),
    probeNeverBounce(),
    probeStock(),
    probeGen(),
    probeVapid(),
    probeAdSense(),
  ])
  const out = {
    fetchedAt: new Date().toISOString(),
    unknownBefore: ['INT-021', 'INT-023', 'INT-026', 'INT-029', 'INT-031', 'INT-032', 'INT-033', 'INT-036'],
    probes,
    okCount: probes.filter((p) => p.ok).length,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
