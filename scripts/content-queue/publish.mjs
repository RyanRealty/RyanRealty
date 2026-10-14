#!/usr/bin/env node
/**
 * Content-queue publisher. DRY RUN BY DEFAULT.
 *
 *   node scripts/content-queue/publish.mjs                       # dry run: due today (PT)
 *   node scripts/content-queue/publish.mjs --date=2026-10-20     # dry run for a given PT date
 *   node scripts/content-queue/publish.mjs --all                 # dry run every queued draft
 *   node scripts/content-queue/publish.mjs --self-test           # build requests for fixtures and assert shape (CI)
 *   CONTENT_QUEUE_LIVE=true node scripts/content-queue/publish.mjs --live
 *
 * A live post needs ALL of: --live, CONTENT_QUEUE_LIVE=true, a green gate, and the
 * platform's credentials. A draft that passes the gate is publishable (Matt
 * 2026-10-14 11:59 PT: no approved: true door). Anything missing => the item is
 * reported and skipped, never posted. The unique publish log
 * (content_queue_published) makes a duplicate post impossible.
 *
 * X Articles have no public create API. x-article drafts are written to a
 * ready-to-paste file (<slug>/x-article.paste.md artifact) for Matt to paste in X.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDraft, listDrafts, readSource, parseFrontmatter, platformKey } from './lib.mjs'
import {
  claimSlot,
  deletePublished,
  insertPublished,
  loadPublishedKeys,
  markPublished,
  ptDate as publishedPtDate,
  releaseSlot,
  scheduledPtDate,
  selectDue,
  slotKey,
} from './published-log.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]

export const LINKEDIN_VERSION = '202509'
export const GBP_BASE = 'https://mybusiness.googleapis.com/v4'

const ptDate = publishedPtDate

/** Build the exact HTTP request each platform's API expects. Token is a placeholder in dry run. */
export function buildRequest(platform, body, data, env, token = '<redacted>') {
  const key = platformKey(platform)
  if (key === 'gbp') {
    const acct = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID || '<GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID>'
    const loc = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID || '<GOOGLE_BUSINESS_PROFILE_LOCATION_ID>'
    const a = String(acct).replace(/^accounts\//, '')
    const l = String(loc).replace(/^locations\//, '')
    const summary = body.replace(data.link, '').replace(/\n{3,}/g, '\n\n').trim()
    const req = { summary, languageCode: 'en-US', topicType: 'STANDARD', callToAction: { actionType: 'LEARN_MORE', url: data.link } }
    if (data.image_url) req.media = [{ mediaFormat: 'PHOTO', sourceUrl: data.image_url }]
    return { method: 'POST', url: `${GBP_BASE}/accounts/${a}/locations/${l}/localPosts`, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: req }
  }
  if (key === 'linkedin-personal' || key === 'linkedin-company') {
    const author = key === 'linkedin-personal'
      ? `urn:li:person:${env.LINKEDIN_PERSON_ID || '<LINKEDIN_PERSON_ID>'}`
      : `urn:li:organization:${env.LINKEDIN_ORGANIZATION_ID || '<LINKEDIN_ORGANIZATION_ID>'}`
    return {
      method: 'POST', url: 'https://api.linkedin.com/rest/posts',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0' },
      // Plain link in commentary, no article card (cards cut reach; see research note).
      body: { author, commentary: body, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false },
    }
  }
  if (key === 'x-post') {
    return { method: 'POST', url: 'https://api.x.com/2/tweets', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: { text: body } }
  }
  if (key === 'x-article') return { method: 'PASTE', url: 'https://x.com/compose/articles', headers: {}, body: { title: data.title || '', text: body } }
  throw new Error(`no builder for ${platform}`)
}

/** Shape check used by --self-test and before every live call. */
export function validateRequest(platform, r) {
  const key = platformKey(platform)
  const errs = []
  if (key === 'gbp') {
    if (!/^https:\/\/mybusiness\.googleapis\.com\/v4\/accounts\/[^/]+\/locations\/[^/]+\/localPosts$/.test(r.url)) errs.push('gbp url')
    if (!r.body.summary || r.body.summary.length > 1500) errs.push('gbp summary missing or > 1500')
    if (r.body.topicType !== 'STANDARD' || r.body.callToAction?.actionType !== 'LEARN_MORE' || !/utm_source=gbp/.test(r.body.callToAction.url)) errs.push('gbp cta')
  } else if (key.startsWith('linkedin')) {
    if (r.url !== 'https://api.linkedin.com/rest/posts' || !r.headers['LinkedIn-Version']) errs.push('linkedin endpoint/version')
    if (!/^urn:li:(person|organization):/.test(r.body.author)) errs.push('linkedin author urn')
    if (!r.body.commentary || r.body.commentary.length > 3000) errs.push('linkedin commentary')
    if (r.body.lifecycleState !== 'PUBLISHED' || r.body.visibility !== 'PUBLIC') errs.push('linkedin lifecycle/visibility')
  } else if (key === 'x-post') {
    if (r.url !== 'https://api.x.com/2/tweets' || !r.body.text) errs.push('x tweet shape')
  } else if (key === 'x-article') {
    if (r.method !== 'PASTE' || !r.body.text) errs.push('x article paste shape')
  }
  return errs
}

async function persistToken(table, env, body) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  await fetch(`${url}/rest/v1/${table}?id=eq.default`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

async function refreshGbp(env, refreshToken) {
  const clientId = env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret || !refreshToken) return { error: 'GBP refresh prerequisites missing' }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  if (!res.ok) return { error: `GBP refresh HTTP ${res.status}` }
  const json = await res.json()
  if (!json.access_token) return { error: 'GBP refresh returned no access_token' }
  await persistToken('google_business_profile_auth', env, {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_at: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  })
  return { token: json.access_token }
}

async function refreshX(env, refreshToken) {
  const id = env.X_CLIENT_ID, secret = env.X_CLIENT_SECRET
  if (!id || !secret || !refreshToken) return { error: 'X refresh prerequisites missing' }
  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) return { error: `X refresh HTTP ${res.status}` }
  const json = await res.json()
  if (!json.access_token) return { error: 'X refresh returned no access_token' }
  await persistToken('x_auth', env, {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_at: new Date(Date.now() + (json.expires_in || 7200) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  })
  return { token: json.access_token }
}

async function supabaseToken(table, env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set' }
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.default&select=access_token,refresh_token,expires_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const [row] = res.ok ? await res.json() : []
  if (!row?.access_token) return { error: `no token row in ${table}` }
  if (!row.expires_at || Date.parse(row.expires_at) >= Date.now() + 60_000) return { token: row.access_token }
  if (table === 'google_business_profile_auth') return refreshGbp(env, row.refresh_token)
  if (table === 'x_auth') return refreshX(env, row.refresh_token)
  return { error: `${table} token expired at ${row.expires_at}; reconnect that platform` }
}

export function publicUrl(platform, responseText) {
  const key = platformKey(platform)
  if (key === 'x-post') {
    try {
      const id = JSON.parse(responseText)?.data?.id
      if (id) return `https://x.com/i/web/status/${id}`
    } catch { /* keep going */ }
  }
  if (key === 'gbp') {
    try {
      const j = JSON.parse(responseText)
      if (j.searchUrl) return j.searchUrl
      if (j.name) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.name)}`
    } catch { /* keep going */ }
  }
  return null
}

const TOKEN_TABLE = { gbp: 'google_business_profile_auth', 'linkedin-personal': 'linkedin_auth', 'linkedin-company': 'linkedin_auth', 'x-post': 'x_auth' }
const REQUIRED_ENV = { gbp: ['GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID', 'GOOGLE_BUSINESS_PROFILE_LOCATION_ID'], 'linkedin-personal': ['LINKEDIN_PERSON_ID'], 'linkedin-company': ['LINKEDIN_ORGANIZATION_ID'], 'x-post': [] }

async function main() {
  const env = process.env
  const live = flag('live') && env.CONTENT_QUEUE_LIVE === 'true'
  if (flag('live') && !live) console.log('--live ignored: CONTENT_QUEUE_LIVE is not "true". Dry run.')
  const outDir = join(ROOT, '.content-queue-out')
  mkdirSync(outDir, { recursive: true })

  if (flag('self-test')) {
    let bad = 0
    for (const d of listDrafts(join(ROOT, 'scripts/content-queue/fixtures/good')).concat(listDrafts(join(ROOT, 'content-queue')))) {
      const { data, body } = parseFrontmatter(readFileSync(d.file, 'utf8'))
      const r = buildRequest(d.platform, body, data, {})
      const errs = validateRequest(d.platform, r)
      if (errs.length) { bad++; console.log(`FAIL request ${d.slug}/${d.platform}: ${errs.join(', ')}`) }
    }
    // Every platform builder must produce a valid request.
    for (const p of ['gbp', 'linkedin-personal', 'linkedin-company', 'x-post-1', 'x-article']) {
      const link = `https://ryan-realty.com/blog/t?utm_source=${p.startsWith('x') ? 'x' : p.startsWith('linkedin') ? 'linkedin' : 'gbp'}&utm_medium=social&utm_campaign=t`
      const errs = validateRequest(p, buildRequest(p, `Body ${link} Ryan Realty LLC`, { link, title: 'T' }, {}))
      console.log(`${errs.length ? 'FAIL' : 'ok  '} ${p} dry-run request builds`)
      if (errs.length) bad++
    }
    if (bad) process.exit(1)
    console.log('publish self-test green')
    return
  }

  const today = opt('date') || ptDate(new Date())
  const catchUp = live && !opt('date') && !flag('all')
  const drafts = listDrafts(join(ROOT, 'content-queue')).map((d) => {
    const scheduledAt = parseFrontmatter(readFileSync(d.file, 'utf8')).data?.scheduled_at
    return { ...d, item: d.slug, channel: d.platform, scheduledAt }
  })
  const logUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const logKey = env.SUPABASE_SERVICE_ROLE_KEY
  const loaded = await loadPublishedKeys({ url: logUrl, key: logKey })
  if (loaded.error) console.log(`publish log: ${loaded.error}`)
  const published = loaded.keys
  const due = flag('all')
    ? drafts
    : selectDue(drafts, { today, catchUp, published })
  console.log(`${live ? 'LIVE' : 'DRY RUN'}: ${due.length} item(s) due ${flag('all') ? '(all)' : catchUp ? `catch-up through ${today}` : today}`)
  const report = []
  let failures = 0
  for (const d of due) {
    const text = readFileSync(d.file, 'utf8')
    const { data, body } = parseFrontmatter(text)
    const gate = checkDraft({ text, platform: d.platform, slug: d.slug, sourceText: readSource(join(ROOT, 'content-queue'), d.slug) || '' })
    const key = platformKey(d.platform)
    const date = scheduledPtDate(data.scheduled_at)
    const slot = date ? slotKey({ item: d.slug, channel: d.platform, date }) : null
    const entry = { item: `${d.slug}/${d.platform}`, scheduled_at: data.scheduled_at, approved: data.approved === true }
    if (gate.length) { entry.status = 'blocked: gate'; entry.errors = gate; failures++; report.push(entry); continue }
    const request = buildRequest(d.platform, body, data, env)
    const shape = validateRequest(d.platform, request)
    if (shape.length) { entry.status = 'blocked: request shape'; entry.errors = shape; failures++; report.push(entry); continue }
    entry.request = request
    if (key === 'x-article') {
      const paste = join(outDir, `${d.slug}.x-article.paste.md`)
      writeFileSync(paste, `# ${data.title || d.slug}\n\n${body}\n`)
      entry.status = `paste file written (X has no Articles API): ${paste}`
      report.push(entry); continue
    }
    if (!live) { entry.status = 'dry run: would post'; report.push(entry); continue }
    if (!slot) { entry.status = 'skipped: no scheduled date'; failures++; report.push(entry); continue }
    if (!claimSlot(published, slot).ok) { entry.status = 'skipped: already published'; report.push(entry); continue }
    const claimed = await insertPublished({ url: logUrl, key: logKey, row: { item: d.slug, channel: d.platform, date, status: 'claimed' } })
    if (!claimed.ok) {
      entry.status = `skipped: ${claimed.reason}`
      if (claimed.reason !== 'already published') failures++
      report.push(entry); continue
    }
    const missing = REQUIRED_ENV[key].filter((n) => !env[n])
    const tok = await supabaseToken(TOKEN_TABLE[key], env)
    if (missing.length || tok.error) {
      await deletePublished({ url: logUrl, key: logKey, row: { item: d.slug, channel: d.platform, date } })
      releaseSlot(published, slot)
      entry.status = 'skipped: missing credentials'
      entry.errors = [...missing.map((m) => `env ${m} not set`), tok.error].filter(Boolean)
      failures++; report.push(entry); continue
    }
    const real = buildRequest(d.platform, body, data, env, tok.token)
    const res = await fetch(real.url, { method: real.method, headers: real.headers, body: JSON.stringify(real.body) })
    const responseText = await res.text()
    if (!res.ok) {
      await deletePublished({ url: logUrl, key: logKey, row: { item: d.slug, channel: d.platform, date } })
      releaseSlot(published, slot)
      entry.status = `post failed ${res.status}`
      entry.response = responseText.slice(0, 300)
      failures++; report.push(entry); continue
    }
    const url = publicUrl(d.platform, responseText)
    await markPublished({ url: logUrl, key: logKey, row: { item: d.slug, channel: d.platform, date, remoteId: url || responseText.slice(0, 200) } })
    entry.status = 'posted'
    entry.public_url = url
    entry.response = res.headers.get('x-restli-id') || responseText.slice(0, 300)
    report.push(entry)
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  for (const e of report) console.log(`- ${e.item}: ${e.status}${e.errors ? ` (${e.errors.join('; ')})` : ''}`)
  if (failures && live) process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1) })
