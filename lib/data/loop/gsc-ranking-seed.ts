/**
 * Ranking seed (THE LOOP measurer half), as a library.
 *
 * Moved out of scripts/seed-gsc-ranking-queue.ts (visibility audit 2026-09-22,
 * PROCESS-1) so the CLI, the weekly cron (app/api/cron/loop-weekly-measure) and
 * the boot brief mint SITE nodes from one rule set. Taste `--seed-draft` mints
 * catalog/look nodes; this mints SITE-* nodes from Search Console gaps:
 * position 5-20 with volume, high-impression zero-click place queries, split
 * landings, missing p1 target queries, and (new) a money page class that lost
 * impressions or position over 28 days. SITE-62 still bans auto-seed from a
 * taste score. Every row has a diagnose rule and a PAGE_OUTLINE winner URL.
 *
 * Changes from the script it replaces, each named:
 *  - rank-tracker queries (quoted, bracketed, operators) are not demand and are
 *    dropped before diagnosis (gsc-trend-1);
 *  - GSC pulls page with startRow instead of one rowLimit-25,000 call;
 *  - a done node no longer blocks the same gap forever: it can be re-seeded
 *    once it has been done for RESEED_AFTER_DAYS, the length of the accept
 *    window, when the gap is still there. A killed node blocks for good.
 * reachability: entry-point scripts/seed-gsc-ranking-queue.ts + app/api/cron/loop-weekly-measure
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, pullAllGscRows, settledEndDate, type GscQueryFn } from './gsc-api'
import { isTrackableQuery } from './gsc-page-class'
import {
  DEGRADED_IMPRESSIONS_DROP_PCT,
  DEGRADED_POSITION_WORSE,
  degradedReason,
  type GscClassDelta,
} from './gsc-trend'
import { assertWorkNodeDraft } from './work-node'

export const MAX_DRAFTS = 12
export const HIGH_IMP = 20
export const TITLE_META_IMP = 80
/** A closed node's gap may be seeded again after one accept window. */
export const RESEED_AFTER_DAYS = 28

export type GscRow = { q: string; impressions: number; clicks: number; position: number }
export type GscQueryPageRow = GscRow & { path: string }
export type Landing = { path: string; impressions: number; clicks: number; position: number }
export type DiagnoseKind = 'title-meta' | 'depth' | 'zero-click' | 'content-strategy' | 'missing-p1' | 'cannibal' | 'class-slip'

export type Gap = {
  q: string
  impressions: number
  clicks: number
  position: number
  kind: DiagnoseKind
  winner: string
  targetQuery: string
}

export type GscGapDraft = {
  versionGap: string
  domain: 'public-ux'
  title: string
  objective: string
  output: string
  accept: string
}

export type SiteRow = {
  version_gap: string | null
  title: string | null
  state?: string | null
  updated_at?: string | null
}

export type TargetQueryRow = { query: string; segment?: string | null; priority?: number | null; target_url?: string | null }

export function ctr(clicks: number, impr: number): number {
  return impr ? (clicks / impr) * 100 : 0
}

export function nextSiteNumber(gaps: string[]): number {
  let max = -1
  for (const g of gaps) {
    const m = String(g).match(/^SITE-(\d+)$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

export function formatSiteGap(n: number): string {
  return n < 10 ? `SITE-0${n}` : `SITE-${n}`
}

export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/"/g, '').trim()
}

/** PAGE_OUTLINE one-winner-per-query. City inventory is the search slug, not /cities. */
export const WINNERS: { needles: string[]; url: string; query: string }[] = [
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

export const LANDING_BUCKETS: Record<string, { url: string; query: string }> = {
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

export function winnerFor(q: string): { url: string; query: string } | null {
  const s = normalizeQuery(q)
  for (const w of WINNERS) {
    if (w.needles.some((n) => s.includes(n))) return { url: w.url, query: w.query }
  }
  return null
}

export function diagnose(row: GscRow, win: { url: string; query: string } | null): DiagnoseKind | null {
  if (!win) return null
  const c = ctr(row.clicks, row.impressions)
  if (row.clicks === 0 && row.impressions >= HIGH_IMP) return 'zero-click'
  if (row.impressions >= TITLE_META_IMP && c < 2 && row.position <= 20) return 'title-meta'
  if (row.position >= 5 && row.position <= 20 && row.impressions >= HIGH_IMP) return 'depth'
  if (row.position > 20 && row.impressions >= HIGH_IMP) return 'content-strategy'
  return null
}

/** The GSC path of a page key, with the query string dropped (case kept for display). */
export function pathOf(page: string): string {
  try {
    const u = new URL(page)
    return u.pathname || '/'
  } catch {
    if (!page) return '/'
    return page.startsWith('/') ? page.split('?')[0] ?? page : `/${page.split('?')[0] ?? page}`
  }
}

/**
 * Only a DONE node can make way for a re-seed: the fix shipped, the accept
 * window passed, and the gap is still in GSC, so the fix did not hold. A KILLED
 * node carries a recorded decision not to do the work (the DB guard requires a
 * reason), and re-minting it every Monday would overrule that decision.
 */
function isClosedLongEnough(row: SiteRow, now: Date): boolean {
  if ((row.state ?? null) !== 'done') return false
  const at = row.updated_at ? Date.parse(row.updated_at) : NaN
  if (!Number.isFinite(at)) return false
  return now.getTime() - at >= RESEED_AFTER_DAYS * 24 * 60 * 60 * 1000
}

/**
 * True when the graph already carries this gap: a node with the same kind and
 * winner that is still live, killed, or done less than RESEED_AFTER_DAYS ago.
 * A row read without state (older callers) always counts as seeded.
 */
export function alreadySeeded(siteRows: SiteRow[], kind: DiagnoseKind, winner: string, now: Date = new Date()): boolean {
  const needle = `GSC gap [${kind}]`
  return siteRows.some((r) => {
    const t = String(r.title ?? '')
    if (!(t.startsWith('GSC gap') && t.includes(needle) && (t.includes(`→ ${winner} (`) || t.endsWith(`→ ${winner}`)))) return false
    return !isClosedLongEnough(r, now)
  })
}

export function kindLabel(kind: DiagnoseKind): string {
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
      return 'must-win query absent from 28d GSC'
    case 'cannibal':
      return 'cannibalization (more than one URL collecting the query)'
    case 'class-slip':
      return 'money page class lost impressions or position, 28d vs the prior 28d'
  }
}

export function toDraft(gap: string, g: Gap): GscGapDraft {
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

export function formatDrafts(drafts: GscGapDraft[], applied: { inserted: number } | null): string {
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

export function cannibalsFromLandings(landings: Record<string, Landing[]>, seenWinner: Set<string>, gaps: Gap[]): void {
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

export function cannibalsFromQueryPages(rows: GscQueryPageRow[], seenWinner: Set<string>, gaps: Gap[]): void {
  const byWinner = new Map<string, { win: { url: string; query: string }; rows: GscQueryPageRow[] }>()
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

/** Rank-tracker probes are not demand (gsc-trend-1). */
export function dropTrackerQueries<T extends { q: string }>(rows: T[]): T[] {
  return rows.filter((r) => isTrackableQuery(r.q))
}

export type GapSeedInput = {
  queries: GscRow[]
  /** Live query x page rows (cannibal check); null when reading a cached JSON. */
  queryPages: GscQueryPageRow[] | null
  /** Cached-JSON landings (cannibal check); null for a live pull. */
  landings: Record<string, Landing[]> | null
  targetQueries: TargetQueryRow[]
  existing: SiteRow[]
  now?: Date
  maxDrafts?: number
  /** First SITE number to hand out (defaults to max existing + 1). */
  firstSiteNumber?: number
}

/** The seeder's diagnosis, pure: GSC rows in, ordered drafts out. */
export function buildGscGapDrafts(input: GapSeedInput): { drafts: GscGapDraft[]; gaps: Gap[]; nextSiteNumber: number } {
  const now = input.now ?? new Date()
  let n = input.firstSiteNumber ?? nextSiteNumber(input.existing.map((r) => String(r.version_gap ?? '')))
  const queries = dropTrackerQueries(input.queries)
  const gaps: Gap[] = []
  const seenWinner = new Set<string>()
  const liveByNeedle = new Map<string, GscRow>()
  for (const r of queries) liveByNeedle.set(normalizeQuery(r.q), r)

  if (input.landings) cannibalsFromLandings(input.landings, seenWinner, gaps)
  else if (input.queryPages) cannibalsFromQueryPages(dropTrackerQueries(input.queryPages), seenWinner, gaps)

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

  for (const t of input.targetQueries.filter((r) => Number(r.priority) === 1)) {
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

  const titles = new Set(input.existing.map((r) => String(r.title ?? '')))
  const drafts: GscGapDraft[] = []
  const max = input.maxDrafts ?? MAX_DRAFTS
  for (const g of gaps) {
    if (alreadySeeded(input.existing, g.kind, g.winner, now)) continue
    const draft = toDraft(formatSiteGap(n), g)
    if (titles.has(draft.title)) continue
    n += 1
    assertWorkNodeDraft(draft)
    drafts.push(draft)
    if (drafts.length >= max) break
  }
  return { drafts, gaps, nextSiteNumber: n }
}

/** The route family a class-slip node points at (display + dedupe key). */
export const CLASS_ROUTE: Record<string, string> = {
  home: '/',
  community: '/communities/[slug]',
  city: '/cities/[slug]',
  'homes-for-sale-city': '/homes-for-sale/[city]',
  'homes-for-sale-type': '/homes-for-sale/[city]/[type]',
  'homes-for-sale-place': '/homes-for-sale/[city]/[place]',
  subdivision: '/subdivisions/[slug]',
}

/**
 * One SITE node per degraded money class (gsc-trend-1: "the brief seeds a
 * ranking node from any degraded class"). Dedupe is the same kind + winner rule
 * as the query gaps, with the class route as the winner.
 */
export function buildClassSlipDrafts(input: {
  degraded: GscClassDelta[]
  anchor: string | null
  existing: SiteRow[]
  firstSiteNumber: number
  now?: Date
}): { drafts: GscGapDraft[]; nextSiteNumber: number } {
  const now = input.now ?? new Date()
  let n = input.firstSiteNumber
  const drafts: GscGapDraft[] = []
  for (const d of input.degraded) {
    const route = CLASS_ROUTE[d.pageClass] ?? `/${d.pageClass}`
    const winner = `${route} (${d.market})`
    if (alreadySeeded(input.existing, 'class-slip', winner, now)) continue
    const reason = degradedReason(d)
    const short = [
      d.impressionsPct != null && d.impressionsPct <= -DEGRADED_IMPRESSIONS_DROP_PCT ? `impr ${d.impressionsPct}%` : null,
      d.positionDelta != null && d.positionDelta >= DEGRADED_POSITION_WORSE ? `pos +${d.positionDelta}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    const window = input.anchor ? `28d to ${input.anchor} vs the 28d before` : '28d vs the prior 28d'
    const draft: GscGapDraft = {
      versionGap: formatSiteGap(n),
      domain: 'public-ux',
      title: `GSC gap [class-slip] ${d.pageClass} → ${winner} (${short})`,
      objective: `Growth diagnose ${kindLabel('class-slip')}. ${d.pageClass} (${d.market}) ${reason}, ${window} (gsc_page_daily via gsc_page_class_rollup). Find the pages that lost the most (gsc_page_daily page rows, same windows) and the change that moved them (canonical, title/H1, index policy, sitemap, internal links, render time), then fix the cause on the class template. Taste score is not the accept.`,
      output: `Per-page loss table for the class (28d vs prior 28d) in evidence, the cause named with its commit, and the fix shipped on the class template.`,
      accept: `28d after ship: ${d.pageClass} (${d.market}) impressions within ${DEGRADED_IMPRESSIONS_DROP_PCT}% of ${d.prev.impressions} and impression-weighted position within ${DEGRADED_POSITION_WORSE} of ${d.prev.position ?? 'the prior value'}, read from gsc_page_class_rollup. Rebaseline is not done.`,
    }
    n += 1
    assertWorkNodeDraft(draft)
    drafts.push(draft)
  }
  return { drafts, nextSiteNumber: n }
}

/** The last settled 28 days (the seeder's window). */
export function seedWindow(now: Date = new Date()): { startDate: string; endDate: string } {
  const endDate = settledEndDate(now)
  return { startDate: addDays(endDate, -27), endDate }
}

/** Query and query x page for the seed window, every row (startRow paging). */
export async function pullGscSeedRows(
  query: GscQueryFn,
  window: { startDate: string; endDate: string },
): Promise<{ queries: GscRow[]; queryPages: GscQueryPageRow[] }> {
  const [q, qp] = await Promise.all([
    pullAllGscRows(query, { ...window, dimensions: ['query'] }),
    pullAllGscRows(query, { ...window, dimensions: ['query', 'page'] }),
  ])
  return {
    queries: q.rows.map((r) => ({ q: r.keys[0] ?? '', impressions: r.impressions, clicks: r.clicks, position: r.position })),
    queryPages: qp.rows.map((r) => ({
      q: r.keys[0] ?? '',
      path: pathOf(r.keys[1] ?? ''),
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
    })),
  }
}

/** Existing SITE nodes (for numbering + dedupe) and the target query registry. */
export async function readSeedContext(
  sb: SupabaseClient,
): Promise<{ existing: SiteRow[]; targetQueries: TargetQueryRow[]; error: string | null; targetQueriesError: string | null }> {
  const [site, tq] = await Promise.all([
    sb.from('loop_work_nodes').select('version_gap,title,state,updated_at').like('version_gap', 'SITE-%'),
    sb.from('target_queries').select('query,segment,priority,target_url'),
  ])
  return {
    existing: (site.data ?? []) as SiteRow[],
    targetQueries: (tq.data ?? []) as TargetQueryRow[],
    error: site.error ? String(site.error.message) : null,
    targetQueriesError: tq.error ? String(tq.error.message) : null,
  }
}

/** Insert drafts as open SITE nodes. Upsert on version_gap, ignoreDuplicates: never clobbers a node's state. */
export async function insertGscGapNodes(
  sb: SupabaseClient,
  drafts: GscGapDraft[],
): Promise<{ inserted: number; versionGaps: string[]; error: string | null }> {
  if (!drafts.length) return { inserted: 0, versionGaps: [], error: null }
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
  if (error) return { inserted: 0, versionGaps: [], error: String(error.message) }
  return {
    inserted: data?.length ?? 0,
    versionGaps: (data ?? []).map((r) => String((r as { version_gap: string }).version_gap)),
    error: null,
  }
}

/** Seed one node per degraded class, deduped. Shared by the weekly cron and the boot brief. */
export async function seedClassSlipNodes(
  sb: SupabaseClient,
  input: { degraded: GscClassDelta[]; anchor: string | null; apply: boolean; now?: Date },
): Promise<{ drafts: GscGapDraft[]; inserted: number; error: string | null }> {
  if (!input.degraded.length) return { drafts: [], inserted: 0, error: null }
  const ctx = await readSeedContext(sb)
  if (ctx.error) return { drafts: [], inserted: 0, error: `SITE gaps unreadable: ${ctx.error}` }
  const { drafts } = buildClassSlipDrafts({
    degraded: input.degraded,
    anchor: input.anchor,
    existing: ctx.existing,
    firstSiteNumber: nextSiteNumber(ctx.existing.map((r) => String(r.version_gap ?? ''))),
    now: input.now,
  })
  if (!input.apply || !drafts.length) return { drafts, inserted: 0, error: null }
  const res = await insertGscGapNodes(sb, drafts)
  return { drafts, inserted: res.inserted, error: res.error }
}
