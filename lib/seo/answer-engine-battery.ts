/**
 * THE ANSWER-ENGINE CITATION BATTERY (AEO-9, visibility audit 2026-09-22).
 *
 * What it measures. Once a month the target query set runs through an answer
 * engine that searches the live web (Grok with the web_search tool, through
 * lib/grok per CLAUDE.md section 4), and for each query we record whether the
 * answer cites ryan-realty.com, at what position among its citations, and
 * which other domains it cites. The loop already sees AI-referred TRAFFIC
 * (site_signal ai_assistant_sessions, from the GA4 snapshot); this is the
 * leading indicator in front of it: are we in the answer at all, and who is.
 *
 * What it is not. A citation list is evidence about one engine on one day, not
 * a ranking and not a number that goes on a public page (section 0). It feeds
 * diagnosis in the loop brief, nothing else. One engine is measured because it
 * is the one the repo already has a governed search surface for; the rows carry
 * the engine name so a second engine can be added beside it without a schema
 * change.
 *
 * Where it lands. marketing_channel_daily (read through the site_signal view),
 * channel 'answer_engine', source ANSWER_ENGINE_SOURCE, keyed per query so a
 * re-run on the same date replaces rather than duplicates.
 */
import aiQueryMap from '@/lib/seo/ai-query-map.json'
import type { MetricRow } from '@/lib/marketing-brain/snapshot'

export const ANSWER_ENGINE_SOURCE = 'answer_engine_battery'
export const ANSWER_ENGINE_CHANNEL = 'answer_engine' as const
export const ANSWER_ENGINE_NAME = 'grok-web-search'
export const OUR_DOMAIN = 'ryan-realty.com'

export type BatteryQuery = {
  id: string
  query: string
  intent: string
  /** Where the query came from: the F1 set, GSC, the SEO desk, or the non-brand set. */
  origin: string
}

/**
 * Non-brand questions a Central Oregon buyer or seller asks an assistant.
 * The first four are the ones the 2026-09-23 audit checked by hand: no
 * ryan-realty.com result in any of them, and the same competitor in all four.
 */
export const NON_BRAND_QUERIES: readonly BatteryQuery[] = [
  { id: 'nb-tetherow-homes', query: 'Tetherow homes for sale', intent: 'community-listings', origin: 'non-brand' },
  { id: 'nb-awbrey-butte', query: 'Awbrey Butte real estate', intent: 'neighborhood', origin: 'non-brand' },
  { id: 'nb-bend-market', query: 'Bend Oregon housing market', intent: 'market-data', origin: 'non-brand' },
  { id: 'nb-bend-mos', query: 'months of supply Bend Oregon', intent: 'market-data', origin: 'non-brand' },
  { id: 'nb-bend-realtor', query: 'real estate agent in Bend Oregon', intent: 'brokerage-identity', origin: 'non-brand' },
  { id: 'nb-redmond-homes', query: 'Redmond Oregon homes for sale', intent: 'city-listings', origin: 'non-brand' },
]

/** The F1 + GSC + desk queries from lib/seo/ai-query-map.json, then the non-brand set. */
export function batteryQueries(): BatteryQuery[] {
  const mapped = (aiQueryMap.queries as Array<{ id: string; query: string; intent: string; source: string }>).map(
    (q) => ({ id: q.id, query: q.query, intent: q.intent, origin: q.source }),
  )
  const seen = new Set<string>()
  const out: BatteryQuery[] = []
  for (const q of [...mapped, ...NON_BRAND_QUERIES]) {
    const key = q.query.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

/** Registrable host of a URL, lowercased, without a leading www. Null when unparseable. */
export function citationHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

function isOurs(host: string): boolean {
  return host === OUR_DOMAIN || host.endsWith(`.${OUR_DOMAIN}`)
}

export type CitationScore = {
  /** True when any cited URL is on ryan-realty.com. */
  cited: boolean
  /** 1-based position of our first cited URL among distinct cited domains, or null. */
  position: number | null
  ourUrls: string[]
  /** Distinct non-Ryan domains, in citation order. */
  competitorDomains: string[]
  /** The answer text names "Ryan Realty", linked or not. */
  brandMentioned: boolean
  citationCount: number
}

export function scoreCitations(citations: readonly string[], answerText: string): CitationScore {
  const domains: string[] = []
  const ourUrls: string[] = []
  for (const url of citations) {
    const host = citationHost(url)
    if (!host) continue
    if (isOurs(host)) ourUrls.push(url)
    const key = isOurs(host) ? OUR_DOMAIN : host
    if (!domains.includes(key)) domains.push(key)
  }
  const ourIndex = domains.indexOf(OUR_DOMAIN)
  return {
    cited: ourIndex >= 0,
    position: ourIndex >= 0 ? ourIndex + 1 : null,
    ourUrls,
    competitorDomains: domains.filter((d) => d !== OUR_DOMAIN),
    brandMentioned: /\bryan realty\b/i.test(answerText),
    citationCount: citations.length,
  }
}

export type BatteryResult = {
  query: BatteryQuery
  /** Null when the engine call failed; the error is recorded instead. */
  score: CitationScore | null
  citations: string[]
  model: string | null
  costUsd: number | null
  error: string | null
}

/** Search function shape (searchGrok's), injected so tests never spend. */
export type BatterySearch = (input: {
  prompt: string
  system: string
  tools: Array<'web_search'>
  maxToolCalls: number
  reasoningEffort: 'low'
  timeoutMs: number
}) => Promise<{ text: string; citations: string[]; model: string; costUsd: number | null }>

const SYSTEM =
  'You are a search assistant answering a person in Central Oregon. Search the web, answer the question in a short paragraph, and cite the pages you used.'

async function runOne(search: BatterySearch, query: BatteryQuery): Promise<BatteryResult> {
  try {
    const res = await search({
      prompt: query.query,
      system: SYSTEM,
      tools: ['web_search'],
      // Each tool call is billed. Three searches answer a one-line question.
      // Measured on the one test run (2026-09-23): 16 queries, 56 s, $9.20
      // reported by xAI for the whole run.
      maxToolCalls: 3,
      reasoningEffort: 'low',
      timeoutMs: 120_000,
    })
    return {
      query,
      score: scoreCitations(res.citations, res.text),
      citations: res.citations,
      model: res.model,
      costUsd: res.costUsd,
      error: null,
    }
  } catch (err) {
    return {
      query,
      score: null,
      citations: [],
      model: null,
      costUsd: null,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
    }
  }
}

/** Run every query, a few at a time, never throwing: a failed query is a recorded error. */
export async function runAnswerEngineBattery(
  search: BatterySearch,
  queries: readonly BatteryQuery[] = batteryQueries(),
  concurrency = 4,
): Promise<BatteryResult[]> {
  const results: BatteryResult[] = new Array(queries.length)
  let next = 0
  const worker = async () => {
    while (next < queries.length) {
      const i = next++
      results[i] = await runOne(search, queries[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queries.length)) }, worker))
  return results
}

/**
 * The rows one run writes. Per query (scope 'campaign', surface 'query:<text>'):
 * cited 0/1, citation_count, brand_mentioned 0/1, and cited_position when
 * cited. Per competitor domain (scope 'source', surface '<domain>'): the
 * number of queries whose answer cited it. One account row set: queries_run,
 * queries_answered, queries_cited. A failed query writes no per-query metric
 * (unknown is not zero) and is counted only in queries_run.
 */
export function batteryRows(date: string, results: readonly BatteryResult[]): MetricRow[] {
  const base = { date, channel: ANSWER_ENGINE_CHANNEL, source: ANSWER_ENGINE_SOURCE }
  const rows: MetricRow[] = []
  const competitorQueries = new Map<string, number>()
  let answered = 0
  let cited = 0
  for (const r of results) {
    if (!r.score) continue
    answered += 1
    if (r.score.cited) cited += 1
    const meta = {
      engine: ANSWER_ENGINE_NAME,
      model: r.model,
      query_id: r.query.id,
      intent: r.query.intent,
      origin: r.query.origin,
      our_urls: r.score.ourUrls,
      competitor_domains: r.score.competitorDomains,
      citations: r.citations.slice(0, 20),
      cost_usd: r.costUsd,
    }
    const scopeId = `query:${r.query.query}`
    rows.push(
      { ...base, scope: 'campaign', scope_id: scopeId, metric: 'cited', value: r.score.cited ? 1 : 0, metadata: meta },
      { ...base, scope: 'campaign', scope_id: scopeId, metric: 'citation_count', value: r.score.citationCount },
      { ...base, scope: 'campaign', scope_id: scopeId, metric: 'brand_mentioned', value: r.score.brandMentioned ? 1 : 0 },
    )
    if (r.score.position != null) {
      rows.push({ ...base, scope: 'campaign', scope_id: scopeId, metric: 'cited_position', value: r.score.position })
    }
    for (const domain of r.score.competitorDomains) {
      competitorQueries.set(domain, (competitorQueries.get(domain) ?? 0) + 1)
    }
  }
  for (const [domain, n] of competitorQueries) {
    rows.push({ ...base, scope: 'source', scope_id: domain, metric: 'competitor_citations', value: n })
  }
  const errors = results.filter((r) => r.error).map((r) => ({ id: r.query.id, error: r.error }))
  rows.push(
    {
      ...base,
      scope: 'account',
      scope_id: '',
      metric: 'queries_run',
      value: results.length,
      metadata: { engine: ANSWER_ENGINE_NAME, errors },
    },
    { ...base, scope: 'account', scope_id: '', metric: 'queries_answered', value: answered },
    { ...base, scope: 'account', scope_id: '', metric: 'queries_cited', value: cited },
  )
  return rows
}
