/**
 * Ranking seed (THE LOOP measurer half).
 *
 * Taste `--seed-draft` mints catalog/look nodes from the table under 70.
 * This script mints SITE-* nodes from Search Console gaps: position 5–20
 * with volume, high-impression zero-click place queries, split landings,
 * and missing p1 target queries. SITE-62 still bans auto-seed from a taste
 * score. Ranking apply is not a median: every row has a diagnose rule and a
 * PAGE_OUTLINE winner URL.
 *
 *   npx tsx scripts/seed-gsc-ranking-queue.ts
 *   npx tsx scripts/seed-gsc-ranking-queue.ts --from-json scratchpad/seo-aeo-gsc-2026-09-22.json
 *   npx tsx scripts/seed-gsc-ranking-queue.ts --apply
 *
 * Dry-run is the default (prints drafts, writes scratchpad/gsc-ranking-seed-draft.ts).
 * `--apply` upserts loop_work_nodes on version_gap with ignoreDuplicates and
 * never clobbers an existing node's state.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { google } from 'googleapis'
import { assertWorkNodeDraft } from '../lib/data/loop/work-node'

for (const f of ['.env.local', '.env']) if (existsSync(f)) loadEnv({ path: f })

const SITE = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || 'https://ryan-realty.com/'
const APPLY = process.argv.includes('--apply')
const fromJsonIdx = process.argv.indexOf('--from-json')
const fromJsonRaw = fromJsonIdx >= 0 ? process.argv[fromJsonIdx + 1] : null
const fromJsonArg = fromJsonRaw && !fromJsonRaw.startsWith('-') ? fromJsonRaw : null
const DEFAULT_CACHE = 'scratchpad/seo-aeo-gsc-2026-09-22.json'
const MAX_DRAFTS = 12
const HIGH_IMP = 20
const TITLE_META_IMP = 80

type GscRow = { q: string; impressions: number; clicks: number; position: number }
type Landing = { path: string; impressions: number; clicks: number; position: number }
type DiagnoseKind = 'title-meta' | 'depth' | 'zero-click' | 'content-strategy' | 'missing-p1' | 'cannibal'

type Gap = {
  q: string
  impressions: number
  clicks: number
  position: number
  kind: DiagnoseKind
  winner: string
  targetQuery: string
}

type Draft = {
  versionGap: string
  domain: 'public-ux'
  title: string
  objective: string
  output: string
  accept: string
}

type SiteRow = { version_gap: string | null; title: string | null }

function ctr(clicks: number, impr: number): number {
  return impr ? (clicks / impr) * 100 : 0
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function nextSiteNumber(gaps: string[]): number {
  let max = -1
  for (const g of gaps) {
    const m = String(g).match(/^SITE-(\d+)$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

function formatSiteGap(n: number): string {
  return n < 10 ? `SITE-0${n}` : `SITE-${n}`
}

function pathOf(page: string): string {
  try {
    const u = new URL(page)
    return u.pathname || '/'
  } catch {
    if (!page) return '/'
    return page.startsWith('/') ? page.split('?')[0] ?? page : `/${page.split('?')[0] ?? page}`
  }
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/"/g, '').trim()
}

/** PAGE_OUTLINE one-winner-per-query. City inventory is the search slug, not /cities. */
const WINNERS: { needles: string[]; url: string; query: string }[] = [
  { needles: ['homes for sale bend', 'bend homes for sale', 'homes for sale in bend', 'bend oregon homes for sale'], url: '/homes-for-sale/bend', query: 'homes for sale bend oregon' },
  { needles: ['central oregon homes for sale', 'homes for sale in central oregon'], url: '/homes-for-sale', query: 'central oregon homes for sale' },
  { needles: ['bend real estate', 'bend oregon real estate'], url: '/cities/bend', query: 'bend oregon real estate' },
  { needles: ['tetherow homes', 'tetherow real estate'], url: '/communities/tetherow', query: 'tetherow homes for sale' },
  { needles: ['brasada ranch homes', 'brasada ranch real estate', 'brasada ranch lots'], url: '/communities/brasada-ranch', query: 'brasada ranch homes for sale' },
  { needles: ['black butte ranch homes', 'black butte ranch real estate'], url: '/communities/black-butte-ranch', query: 'black butte ranch homes for sale' },
  { needles: ['broken top homes', 'broken top real estate'], url: '/communities/broken-top', query: 'broken top homes for sale' },
  { needles: ['sunriver homes', 'sunriver real estate'], url: '/communities/sunriver', query: 'sunriver homes for sale' },
  { needles: ['caldera springs homes', 'caldera springs real estate'], url: '/communities/caldera-springs', query: 'caldera springs homes for sale' },
  { needles: ['awbrey butte homes', 'awbrey butte real estate'], url: '/cities/bend/awbrey-butte', query: 'awbrey butte homes for sale' },
  { needles: ['redmond oregon homes', 'homes for sale in redmond', 'redmond homes for sale'], url: '/homes-for-sale/redmond', query: 'redmond oregon homes for sale' },
  { needles: ['sisters oregon homes', 'homes for sale in sisters', 'sisters homes for sale'], url: '/homes-for-sale/sisters', query: 'sisters oregon homes for sale' },
  { needles: ['luxury homes bend', 'luxury homes for sale in bend', 'bend luxury'], url: '/homes-for-sale/bend/luxury', query: 'luxury homes bend oregon' },
  { needles: ['new construction bend', 'new homes for sale in bend', 'new construction homes bend'], url: '/new-construction', query: 'new construction bend oregon' },
  { needles: ['ryan realty'], url: '/', query: 'ryan realty' },
]

const LANDING_BUCKETS: Record<string, { url: string; query: string }> = {
  brand: { url: '/', query: 'ryan realty' },
  centralOregonHomes: { url: '/homes-for-sale', query: 'central oregon homes for sale' },
  bendHomes: { url: '/homes-for-sale/bend', query: 'homes for sale bend oregon' },
  tetherow: { url: '/communities/tetherow', query: 'tetherow homes for sale' },
  caldera: { url: '/communities/caldera-springs', query: 'caldera springs homes for sale' },
  brokenTop: { url: '/communities/broken-top', query: 'broken top homes for sale' },
  awbrey: { url: '/cities/bend/awbrey-butte', query: 'awbrey butte homes for sale' },
  sisters: { url: '/homes-for-sale/sisters', query: 'sisters oregon homes for sale' },
  redmond: { url: '/homes-for-sale/redmond', query: 'redmond oregon homes for sale' },
  sunriver: { url: '/communities/sunriver', query: 'sunriver homes for sale' },
  newConstruction: { url: '/new-construction', query: 'new construction bend oregon' },
}

function winnerFor(q: string): { url: string; query: string } | null {
  const s = normalizeQuery(q)
  for (const w of WINNERS) {
    if (w.needles.some((n) => s.includes(n))) return { url: w.url, query: w.query }
  }
  return null
}

function diagnose(row: GscRow, win: { url: string; query: string } | null): DiagnoseKind | null {
  if (!win) return null
  const c = ctr(row.clicks, row.impressions)
  if (row.clicks === 0 && row.impressions >= HIGH_IMP) return 'zero-click'
  if (row.impressions >= TITLE_META_IMP && c < 2 && row.position <= 20) return 'title-meta'
  if (row.position >= 5 && row.position <= 20 && row.impressions >= HIGH_IMP) return 'depth'
  if (row.position > 20 && row.impressions >= HIGH_IMP) return 'content-strategy'
  return null
}

function gscClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  return google.searchconsole({ version: 'v1', auth })
}

function gscWindow(): { startDate: string; endDate: string } {
  const end = new Date(Date.now() - 3 * 86400000)
  const start = new Date(end.getTime() - 27 * 86400000)
  return { startDate: fmt(start), endDate: fmt(end) }
}

async function pullGscQueries(): Promise<GscRow[]> {
  const sc = gscClient()
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      ...gscWindow(),
      dimensions: ['query'],
      rowLimit: 25000,
    },
  })
  return (data.rows ?? []).map((r) => ({
    q: String(r.keys?.[0] ?? ''),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    position: Number(r.position ?? 0),
  }))
}

async function pullGscQueryPages(): Promise<Array<GscRow & { path: string }>> {
  const sc = gscClient()
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: {
      ...gscWindow(),
      dimensions: ['query', 'page'],
      rowLimit: 25000,
    },
  })
  return (data.rows ?? []).map((r) => ({
    q: String(r.keys?.[0] ?? ''),
    path: pathOf(String(r.keys?.[1] ?? '')),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    position: Number(r.position ?? 0),
  }))
}

function queriesFromCachedJson(path: string): GscRow[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    named?: Record<string, { top?: GscRow[] }>
    pos515?: GscRow[]
    highImpLowCtr?: GscRow[]
    posGt15Pri?: GscRow[]
    topQueries?: GscRow[]
  }
  const seen = new Map<string, GscRow>()
  const add = (rows: GscRow[] | undefined) => {
    for (const r of rows ?? []) {
      if (!r?.q) continue
      const prev = seen.get(r.q)
      if (!prev || r.impressions > prev.impressions) seen.set(r.q, r)
    }
  }
  add(raw.topQueries)
  add(raw.pos515)
  add(raw.highImpLowCtr)
  add(raw.posGt15Pri)
  for (const bucket of Object.values(raw.named ?? {})) add(bucket.top)
  return [...seen.values()]
}

function alreadySeeded(siteRows: SiteRow[], kind: DiagnoseKind, winner: string): boolean {
  const needle = `GSC gap [${kind}]`
  return siteRows.some((r) => {
    const t = String(r.title ?? '')
    return t.startsWith('GSC gap') && t.includes(needle) && t.includes(`→ ${winner}`)
  })
}

function kindLabel(kind: DiagnoseKind): string {
  switch (kind) {
    case 'title-meta':
      return 'title/meta (high impressions, CTR < 2%)'
    case 'depth':
      return 'on-page depth (position 5–20 + volume)'
    case 'zero-click':
      return 'high-impression zero-click place query'
    case 'content-strategy':
      return 'content-strategy (p1 or volume, position >20)'
    case 'missing-p1':
      return 'must-win query absent from 28d GSC (outside daily top-25 ingest)'
    case 'cannibal':
      return 'cannibalization (more than one URL collecting the query)'
  }
}

function toDraft(gap: string, g: Gap): Draft {
  const pos = g.position.toFixed(1)
  const c = ctr(g.clicks, g.impressions).toFixed(2)
  return {
    versionGap: gap,
    domain: 'public-ux',
    title: `GSC gap [${g.kind}] ${g.targetQuery} → ${g.winner} (pos ${pos}, ${g.impressions} impr, CTR ${c}%)`,
    objective: `Growth diagnose ${kindLabel(g.kind)}. Live query ${JSON.stringify(g.q)} should rank at ${g.winner} (PAGE_OUTLINE one-winner). Do not retarget /cities/* for a homes-for-sale query. Taste score is not the accept. Product hold still binds.`,
    output: `On-page / canonical / internal-link change on ${g.winner}; GSC query×page re-pull in evidence.`,
    accept: `28d after ship: GSC position for ${JSON.stringify(g.targetQuery)} is closer to 1 than the baseline ${pos} OR clicks rose with no CTR collapse; a single URL (${g.winner}) holds ≥80% of query×page impressions for that query. Taste rebaseline is not done. Rebaseline is not done.`,
  }
}

function formatDrafts(drafts: Draft[], applied: { inserted: number } | null): string {
  const banner = applied
    ? [
        `APPLY — upserted ${applied.inserted} new SITE nodes (ignoreDuplicates; existing state untouched).`,
        'SITE-62 still binds taste seeds. Ranking seeds are this file, not taste-table --seed-draft.',
        '',
      ].join('\n')
    : [
        'DRAFT — not seeded. Nothing was written to loop_work_nodes.',
        'Review, then `npx tsx scripts/seed-gsc-ranking-queue.ts --apply` (upsert, never clobbers state).',
        'SITE-62 still binds taste seeds. Ranking seeds are this file, not taste-table --seed-draft.',
        '',
      ].join('\n')
  const body = drafts
    .map(
      (d) => `  {
    versionGap: ${JSON.stringify(d.versionGap)},
    domain: ${JSON.stringify(d.domain)},
    title: ${JSON.stringify(d.title)},
    objective:
      ${JSON.stringify(d.objective)},
    output: ${JSON.stringify(d.output)},
    accept:
      ${JSON.stringify(d.accept)},
  },`,
    )
    .join('\n')
  return `${banner}${body}\n`
}

function addGap(gaps: Gap[], seenWinner: Set<string>, g: Gap): void {
  const key = `${g.winner}\0${g.kind}`
  if (seenWinner.has(key)) return
  seenWinner.add(key)
  gaps.push(g)
}

function cannibalsFromLandings(landings: Record<string, Landing[]>, seenWinner: Set<string>, gaps: Gap[]): void {
  for (const [bucket, rows] of Object.entries(landings)) {
    if (!rows || rows.length < 2) continue
    const win = LANDING_BUCKETS[bucket] ?? WINNERS.find((w) => w.query.includes(bucket.toLowerCase()))
    const winnerUrl = win && 'url' in win ? win.url : undefined
    if (!winnerUrl) continue
    const others = rows.filter((r) => pathOf(r.path) !== winnerUrl)
    if (others.length === 0) continue
    const impr = rows.reduce((a, r) => a + r.impressions, 0)
    const winnerImpr = rows.filter((r) => pathOf(r.path) === winnerUrl).reduce((a, r) => a + r.impressions, 0)
    if (impr > 0 && winnerImpr / impr >= 0.8) continue
    const top = rows[0]
    addGap(gaps, seenWinner, {
      q: `${bucket} split across ${rows.map((r) => pathOf(r.path)).slice(0, 4).join(', ')}`,
      impressions: impr,
      clicks: rows.reduce((a, r) => a + r.clicks, 0),
      position: top?.position ?? 0,
      kind: 'cannibal',
      winner: winnerUrl,
      targetQuery: (win as { query: string }).query ?? bucket,
    })
  }
}

function cannibalsFromQueryPages(rows: Array<GscRow & { path: string }>, seenWinner: Set<string>, gaps: Gap[]): void {
  const byWinner = new Map<string, { win: { url: string; query: string }; rows: Array<GscRow & { path: string }> }>()
  for (const r of rows) {
    const win = winnerFor(r.q)
    if (!win) continue
    const cur = byWinner.get(win.url) ?? { win, rows: [] }
    cur.rows.push(r)
    byWinner.set(win.url, cur)
  }
  for (const { win, rows: wr } of byWinner.values()) {
    const byPath = new Map<string, { impressions: number; clicks: number; position: number }>()
    for (const r of wr) {
      const p = pathOf(r.path)
      const prev = byPath.get(p) ?? { impressions: 0, clicks: 0, position: r.position }
      prev.impressions += r.impressions
      prev.clicks += r.clicks
      byPath.set(p, prev)
    }
    if (byPath.size < 2) continue
    const impr = [...byPath.values()].reduce((a, r) => a + r.impressions, 0)
    const winnerImpr = byPath.get(win.url)?.impressions ?? 0
    if (impr > 0 && winnerImpr / impr >= 0.8) continue
    const ranked = [...byPath.entries()].sort((a, b) => b[1].impressions - a[1].impressions)
    const top = ranked[0]
    addGap(gaps, seenWinner, {
      q: `${win.query} split across ${ranked.map(([p]) => p).slice(0, 4).join(', ')}`,
      impressions: impr,
      clicks: [...byPath.values()].reduce((a, r) => a + r.clicks, 0),
      position: top?.[1].position ?? 0,
      kind: 'cannibal',
      winner: win.url,
      targetQuery: win.query,
    })
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const [{ data: siteRows, error: siteErr }, { data: tq, error: tqErr }] = await Promise.all([
    sb.from('loop_work_nodes').select('version_gap,title').like('version_gap', 'SITE-%'),
    sb.from('target_queries').select('query,segment,priority,target_url'),
  ])
  if (siteErr) {
    console.error('SITE gaps unreadable:', siteErr.message)
    process.exit(1)
  }
  if (tqErr) console.error('target_queries:', tqErr.message)

  const existing = (siteRows ?? []) as SiteRow[]
  const used = existing.map((r) => String(r.version_gap ?? ''))
  let n = nextSiteNumber(used)

  let jsonPath = fromJsonArg && existsSync(fromJsonArg) ? fromJsonArg : null

  let queries: GscRow[] = []
  let livePages: Array<GscRow & { path: string }> | null = null
  if (jsonPath) {
    queries = queriesFromCachedJson(jsonPath)
  } else {
    try {
      const [q, pages] = await Promise.all([pullGscQueries(), pullGscQueryPages()])
      queries = q
      livePages = pages
    } catch (err) {
      if (existsSync(DEFAULT_CACHE)) {
        console.error(`GSC live pull failed (${(err as Error).message}); falling back to ${DEFAULT_CACHE}`)
        jsonPath = DEFAULT_CACHE
        queries = queriesFromCachedJson(DEFAULT_CACHE)
      } else {
        throw err
      }
    }
  }

  const gaps: Gap[] = []
  const seenWinner = new Set<string>()
  const tqList = tq ?? []
  const liveByNeedle = new Map<string, GscRow>()
  for (const r of queries) liveByNeedle.set(normalizeQuery(r.q), r)

  if (jsonPath && existsSync(jsonPath)) {
    const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as { landings?: Record<string, Landing[]> }
    cannibalsFromLandings(raw.landings ?? {}, seenWinner, gaps)
  } else if (livePages) {
    cannibalsFromQueryPages(livePages, seenWinner, gaps)
  }

  for (const row of queries) {
    const win = winnerFor(row.q)
    const kind = diagnose(row, win)
    if (!kind || !win) continue
    addGap(gaps, seenWinner, {
      q: row.q,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      kind,
      winner: win.url,
      targetQuery: win.query,
    })
  }

  for (const t of tqList.filter((r) => Number(r.priority) === 1)) {
    const needle = normalizeQuery(String(t.query))
    const live = [...liveByNeedle.entries()].find(([q]) => q.includes(needle) || needle.includes(q))
    if (live) continue
    const win = winnerFor(needle) ?? { url: String(t.target_url ?? ''), query: String(t.query) }
    if (!win.url) continue
    addGap(gaps, seenWinner, {
      q: String(t.query),
      impressions: 0,
      clicks: 0,
      position: 99,
      kind: 'missing-p1',
      winner: win.url,
      targetQuery: String(t.query),
    })
  }

  gaps.sort((a, b) => b.impressions - a.impressions || a.position - b.position)

  const drafts: Draft[] = []
  for (const g of gaps) {
    if (alreadySeeded(existing, g.kind, g.winner)) continue
    const gap = formatSiteGap(n)
    n += 1
    const draft = toDraft(gap, g)
    assertWorkNodeDraft(draft)
    drafts.push(draft)
    if (drafts.length >= MAX_DRAFTS) break
  }

  let inserted = 0
  if (APPLY && drafts.length) {
    const rows = drafts.map((s) => ({
      version_gap: s.versionGap,
      domain: s.domain,
      title: s.title,
      objective: s.objective,
      output: s.output,
      accept: s.accept,
    }))
    const { data, error } = await sb
      .from('loop_work_nodes')
      .upsert(rows, { onConflict: 'version_gap', ignoreDuplicates: true })
      .select('id,version_gap')
    if (error) {
      console.error('seed-gsc-ranking-queue apply failed:', error.message)
      process.exit(1)
    }
    inserted = data?.length ?? 0
  }

  const text = formatDrafts(drafts, APPLY ? { inserted } : null)
  const outPath = 'scratchpad/gsc-ranking-seed-draft.ts'
  try {
    writeFileSync(outPath, text)
  } catch (err) {
    console.error(`could not write ${outPath}: ${(err as Error).message}`)
  }

  const source = jsonPath ? `json ${jsonPath}` : 'live GSC'
  console.log(
    `used SITE gaps ${used.length} · next ${formatSiteGap(nextSiteNumber(used))} · GSC queries ${queries.length} (${source}) · drafts ${drafts.length}${APPLY ? ` · inserted ${inserted}` : ' · dry-run'}`,
  )
  console.log(text)
  console.log(`RESULT drafts=${drafts.length} inserted=${APPLY ? inserted : 0} skipped=${gaps.length - drafts.length} apply=${APPLY}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
