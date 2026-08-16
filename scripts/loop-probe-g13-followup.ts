/**
 * Follow-up probes: Sentry ingest, production AdSense/VAPID presence.
 * No generate, no send to people.
 *
 *   npx tsx scripts/loop-probe-g13-followup.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

async function text(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RyanRealty-G13-probe/1.0', ...headers },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  })
  const body = await res.text()
  return { status: res.status, body, url: res.url }
}

async function json(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  const raw = await res.text()
  let body: unknown = raw
  try {
    body = JSON.parse(raw)
  } catch {
    /* keep */
  }
  return { status: res.status, body, text: raw.slice(0, 300) }
}

async function sentryFollowup() {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim()
  const dsn = process.env.SENTRY_DSN?.trim()
  const projectMatch = dsn?.match(/\.sentry\.io\/(\d+)/) ?? dsn?.match(/\/(\d+)\s*$/)
  const projectId = projectMatch?.[1] ?? null
  const hostMatch = dsn?.match(/@([^/]+)\//)
  const ingestHost = hostMatch?.[1] ?? null

  const endpoints = [
    'https://sentry.io/api/0/',
    'https://sentry.io/api/0/projects/',
    'https://us.sentry.io/api/0/projects/',
  ]
  const hits = []
  for (const url of endpoints) {
    if (!token) break
    const r = await json(url, { Authorization: `Bearer ${token}` })
    hits.push({ url, status: r.status, snippet: r.text.slice(0, 160) })
  }

  // Production JS: is Sentry initialized?
  const home = await text('https://ryan-realty.com/')
  const hasSentrySdk =
    home.body.includes('sentry') ||
    home.body.includes('Sentry') ||
    home.body.includes('ingest.sentry.io')
  const scriptSrcs = [...home.body.matchAll(/src="([^"]+_next\/static\/[^"]+\.js)"/g)].map((m) => m[1])
  const sampleScripts = scriptSrcs.slice(0, 8)
  let sentryInBundle = false
  for (const src of sampleScripts) {
    const abs = src.startsWith('http') ? src : `https://ryan-realty.com${src}`
    const js = await text(abs)
    if (js.body.includes('ingest.sentry.io') || js.body.includes('sentry.io')) {
      sentryInBundle = true
      break
    }
  }

  return {
    projectId,
    ingestHost,
    api: hits,
    productionHtmlMentionsSentry: hasSentrySdk,
    sentryInSampledBundles: sentryInBundle,
    sampledBundles: sampleScripts.length,
  }
}

async function adsenseFollowup() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ?? ''
  const pages = [
    'https://ryan-realty.com/tools/appreciation',
    'https://ryan-realty.com/activity',
    'https://ryan-realty.com/about',
    'https://ryan-realty.com/cities/bend',
  ]
  const pageHits = []
  for (const page of pages) {
    const r = await text(page)
    pageHits.push({
      path: new URL(page).pathname,
      status: r.status,
      adsbygoogle: r.body.includes('adsbygoogle'),
      client: client ? r.body.includes(client) : false,
      googlesyndication: r.body.includes('googlesyndication'),
    })
  }
  const home = await text('https://ryan-realty.com/')
  const scriptSrcs = [...home.body.matchAll(/src="([^"]+_next\/static\/[^"]+\.js)"/g)].map((m) => m[1])
  let clientInBundle = false
  let adsenseLoader = false
  for (const src of scriptSrcs.slice(0, 12)) {
    const abs = src.startsWith('http') ? src : `https://ryan-realty.com${src}`
    const js = await text(abs)
    if (client && js.body.includes(client)) clientInBundle = true
    if (js.body.includes('adsbygoogle') || js.body.includes('pagead2.googlesyndication.com')) {
      adsenseLoader = true
    }
  }
  return { clientPrefix: client ? `${client.slice(0, 10)}…` : 'missing', pageHits, clientInBundle, adsenseLoader }
}

async function vapidFollowup() {
  const sw = await text('https://ryan-realty.com/sw.js')
  const home = await text('https://ryan-realty.com/')
  const scriptSrcs = [...home.body.matchAll(/src="([^"]+_next\/static\/[^"]+\.js)"/g)].map((m) => m[1])
  let vapidInBundle = false
  for (const src of scriptSrcs.slice(0, 12)) {
    const abs = src.startsWith('http') ? src : `https://ryan-realty.com${src}`
    const js = await text(abs)
    if (js.body.includes('VAPID') || js.body.includes('applicationServerKey') || js.body.includes('pushManager')) {
      vapidInBundle = true
      break
    }
  }
  return {
    swStatus: sw.status,
    swHasPush: sw.body.includes('push') || sw.body.includes('PushEvent'),
    vapidInBundle,
  }
}

async function main() {
  const [sentry, adsense, vapid] = await Promise.all([
    sentryFollowup(),
    adsenseFollowup(),
    vapidFollowup(),
  ])
  console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), sentry, adsense, vapid }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
