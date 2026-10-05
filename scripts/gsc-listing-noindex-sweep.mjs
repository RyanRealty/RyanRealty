#!/usr/bin/env node
/**
 * gsc-listing-noindex-sweep.mjs — find the sitemap listing URLs Google still
 * holds in a bad index state, record them, and ask Google to recrawl them.
 *
 * WHY (GSC slide fix, 2026-10-05). Until 7e392cc4 (2026-10-04) a failed listing
 * lookup served a 200 "We can't show this home" page with noindex. URL
 * Inspection on a random 150 of the 3,247 sitemap listing URLs found 12 (8%)
 * still "Excluded by 'noindex' tag", all crawled in a 09-05/09-06 burst, 8 with
 * a Google-selected canonical pointing at a DIFFERENT listing (the failure page
 * body was identical on every listing). Live pages now answer index,follow and
 * a failed lookup now answers 503 (lib/routing/listing-unavailable.ts), but
 * Google keeps the bad verdict until it recrawls.
 *
 * WHAT IT DOES
 *   1. Fetches the live https://ryan-realty.com/sitemaps/listings.xml.
 *   2. Runs URL Inspection on every URL not yet inspected (state file), up to
 *      --cap per run (default 1,800; the API allows 2,000 per property per day).
 *      A quota error stops the run cleanly and the state keeps what was done.
 *   3. Flags a URL when coverageState is "Excluded by 'noindex' tag"
 *      (flag noindex), or when Google's canonical differs from ours
 *      (userCanonical, or the URL itself when the page declared none) (flag
 *      canonical_mismatch). Flagged URLs are upserted into
 *      public.gsc_listing_index_flags with recrawl_after = this run's start;
 *      an inspected URL that is healthy is deleted from it. The listings
 *      sitemap then emits lastmod >= recrawl_after for those URLs
 *      (lib/data/sitemap/getListingSitemapRows.ts).
 *   4. Resubmits the listings sitemap through the Search Console sitemaps API.
 *
 * Usage:
 *   node scripts/gsc-listing-noindex-sweep.mjs                 # next 1,800, write, resubmit
 *   node scripts/gsc-listing-noindex-sweep.mjs --cap 200       # smaller run
 *   node scripts/gsc-listing-noindex-sweep.mjs --dry-run       # inspect only, no DB write, no submit
 *   node scripts/gsc-listing-noindex-sweep.mjs --reset         # forget the state, start over
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * (the Search Console service account every scripts/*gsc* script uses),
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * State: tmp/gsc-listing-noindex-sweep/state.json (gitignored), resumable.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { google } from 'googleapis'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SITE_URL = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'
const SITEMAP_URL = 'https://ryan-realty.com/sitemaps/listings.xml'
const NOINDEX_STATE = "Excluded by 'noindex' tag"

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const CAP = Number(arg('--cap', '1800'))
const CONCURRENCY = Math.max(1, Math.min(8, Number(arg('--concurrency', '4'))))
const STATE_PATH = resolve(ROOT, arg('--state', 'tmp/gsc-listing-noindex-sweep/state.json'))
const DRY = process.argv.includes('--dry-run')
const NO_SUBMIT = process.argv.includes('--no-submit') || DRY
const RESET = process.argv.includes('--reset')

/** The MLS number at the tail of a listing path (address-220226356). */
export function listingNumberFromUrl(url) {
  try {
    const p = new URL(url).pathname.replace(/\/$/, '')
    return p.match(/-([0-9]{5,})$/)?.[1] ?? p.match(/([0-9]{5,})$/)?.[1] ?? null
  } catch {
    return null
  }
}

function norm(u) {
  return String(u ?? '').trim().replace(/\/$/, '')
}

/** The flag for one inspection result, or null when the URL is healthy. */
export function flagFor(url, r) {
  if (!r) return null
  if (r.coverageState === NOINDEX_STATE) return 'noindex'
  const ours = norm(r.userCanonical || url)
  if (r.googleCanonical && norm(r.googleCanonical) !== ours) return 'canonical_mismatch'
  return null
}

function loadState() {
  if (RESET || !existsSync(STATE_PATH)) return { done: {}, runs: [] }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true })
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 1))
}

async function fetchSitemapUrls() {
  const res = await fetch(SITEMAP_URL, { headers: { 'user-agent': 'RyanRealty-gsc-sweep/1.0' } })
  if (!res.ok) throw new Error(`${SITEMAP_URL} answered HTTP ${res.status}`)
  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => !/\.(jpe?g|png|webp)$/i.test(u))
  if (urls.length === 0) throw new Error(`${SITEMAP_URL} held no <loc> entries`)
  return [...new Set(urls)]
}

function isQuotaError(err) {
  const code = err?.code ?? err?.response?.status
  const msg = String(err?.message ?? '')
  return code === 429 || /quota/i.test(msg) || /rate limit/i.test(msg)
}

async function supabaseRest(path, init = {}) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!base || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`PostgREST ${path.split('?')[0]} answered ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res
}

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY missing')
  const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/webmasters'] })
  const sc = google.searchconsole({ version: 'v1', auth })
  const wm = google.webmasters({ version: 'v3', auth })

  const runStartedAt = new Date().toISOString()
  const state = loadState()
  const urls = await fetchSitemapUrls()
  const todo = urls.filter((u) => !state.done[u]).slice(0, CAP)
  console.log(`Sitemap ${SITEMAP_URL}: ${urls.length} listing URLs. Already inspected: ${urls.length - urls.filter((u) => !state.done[u]).length}. This run: ${todo.length} (cap ${CAP}).`)

  const results = []
  let next = 0
  let quotaHit = null
  let errors = 0
  async function worker() {
    while (!quotaHit && next < todo.length) {
      const url = todo[next++]
      try {
        const { data } = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl: SITE_URL } })
        const r = data.inspectionResult?.indexStatusResult ?? {}
        const rec = {
          coverageState: r.coverageState ?? null,
          verdict: r.verdict ?? null,
          googleCanonical: r.googleCanonical ?? null,
          userCanonical: r.userCanonical ?? null,
          lastCrawlTime: r.lastCrawlTime ?? null,
          inspectedAt: new Date().toISOString(),
        }
        state.done[url] = rec
        results.push({ url, ...rec })
        if (results.length % 100 === 0) {
          saveState(state)
          console.log(`  ${results.length}/${todo.length} inspected`)
        }
      } catch (err) {
        if (isQuotaError(err)) {
          quotaHit = String(err?.message ?? err).slice(0, 200)
          break
        }
        errors++
        console.error(`  ERR ${url}: ${String(err?.message ?? err).slice(0, 160)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  saveState(state)

  const flagged = results
    .map((r) => ({ ...r, flag: flagFor(r.url, r) }))
    .filter((r) => r.flag)
  const healthy = results.filter((r) => !flagFor(r.url, r)).map((r) => r.url)

  const byCoverage = {}
  for (const r of results) byCoverage[r.coverageState ?? '(none)'] = (byCoverage[r.coverageState ?? '(none)'] ?? 0) + 1
  const byFlag = {}
  for (const r of flagged) byFlag[r.flag] = (byFlag[r.flag] ?? 0) + 1
  const bothNoindexAndMerged = flagged.filter(
    (r) => r.flag === 'noindex' && r.googleCanonical && norm(r.googleCanonical) !== norm(r.userCanonical || r.url),
  ).length

  if (!DRY && (flagged.length || healthy.length)) {
    if (flagged.length) {
      const rows = flagged.map((r) => ({
        url: r.url,
        listing_number: listingNumberFromUrl(r.url) ?? '',
        flag: r.flag,
        coverage_state: r.coverageState,
        google_canonical: r.googleCanonical,
        user_canonical: r.userCanonical,
        last_crawl_at: r.lastCrawlTime,
        inspected_at: r.inspectedAt,
        recrawl_after: runStartedAt,
      }))
      for (let i = 0; i < rows.length; i += 500) {
        await supabaseRest('gsc_listing_index_flags?on_conflict=url', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(rows.slice(i, i + 500)),
        })
      }
    }
    // A URL that inspects healthy now leaves the table (and the lastmod bump).
    for (let i = 0; i < healthy.length; i += 100) {
      const list = healthy.slice(i, i + 100).map((u) => `"${u.replace(/"/g, '')}"`).join(',')
      await supabaseRest(`gsc_listing_index_flags?url=in.(${encodeURIComponent(list)})`, { method: 'DELETE' })
    }
  }

  let submitted = null
  if (!NO_SUBMIT) {
    try {
      await wm.sitemaps.submit({ siteUrl: SITE_URL, feedpath: SITEMAP_URL })
      submitted = new Date().toISOString()
    } catch (err) {
      console.error(`Sitemap resubmit failed: ${String(err?.message ?? err).slice(0, 200)}`)
    }
  }

  const remaining = urls.filter((u) => !state.done[u]).length
  const summary = {
    runStartedAt,
    sitemapUrls: urls.length,
    inspectedThisRun: results.length,
    errors,
    quotaHit,
    coverageStates: byCoverage,
    flaggedThisRun: flagged.length,
    flags: byFlag,
    noindexAlsoMerged: bothNoindexAndMerged,
    remaining,
    wroteToSupabase: !DRY,
    sitemapResubmittedAt: submitted,
  }
  state.runs.push(summary)
  saveState(state)

  console.log('\n' + JSON.stringify(summary, null, 1))
  if (flagged.length) {
    console.log('\nFlagged this run:')
    for (const r of flagged) {
      console.log(`  ${r.flag.padEnd(19)} ${r.url.replace('https://ryan-realty.com', '')}  crawl:${(r.lastCrawlTime ?? '').slice(0, 10)}  gc:${(r.googleCanonical ?? '').replace('https://ryan-realty.com', '')}`)
    }
  }
  if (remaining > 0) {
    console.log(`\n${remaining} URLs left. Next run (after the daily quota resets at midnight Pacific):`)
    console.log('  node scripts/gsc-listing-noindex-sweep.mjs')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal:', err?.message ?? err)
    process.exit(1)
  })
}
