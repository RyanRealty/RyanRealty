/**
 * The subdivision story — the homeowner's deep read on their own street
 * (Matt 2026-08-05: "review all past sales and photos with those sales, tell
 * a story. I'm a homeowner and this is everything I could possibly want to
 * know about my home. This is where we provide our value.").
 *
 * Two layers, strictly separated per §0:
 *   1. FACTS — computed here, deterministically, from the full closed-sale
 *      history of the subdivision: the yearly price path, records, pace,
 *      sale-to-list, and where the subject sits in the distribution. Every
 *      number a reader sees comes from this layer.
 *   2. STORY — one Claude pass over those facts + each sale's remarks + the
 *      hero photos of the most recent sales (vision), writing the narrative a
 *      neighbor would actually want to read. The prompt forbids new numbers;
 *      the build's brand-voice gate runs over every sentence; the pass fails
 *      OPEN (no key / error → the deterministic facts still render, no prose).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CmaSubject } from '@/lib/cma/types'
import type { CmaSubdivisionHistoryRow } from '@/lib/data/cma/builderReads'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { sparkPhotoAt } from '@/lib/cma/render-blocks'

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003
const OUTPUT_COST_PER_TOKEN = 0.000015
const MAX_PHOTO_SALES = 4
export const SUBDIVISION_STORY_YEARS = 10

export interface SubdivisionYearFact {
  year: number
  count: number
  medianClose: number
  medianPpsf: number | null
}

export interface SubdivisionNotableSale {
  listNumber: string | null
  address: string
  closePrice: number
  closeDate: string
  sqft: number | null
  photoUrl: string | null
  /** AI one-liner grounded on this sale's remarks/photo; empty when no AI pass ran. */
  line: string
}

export interface SubdivisionStoryFacts {
  name: string
  totalSales: number
  years: SubdivisionYearFact[]
  recordHigh: { price: number; address: string; date: string } | null
  recordLow: { price: number; address: string; date: string } | null
  medianDomRecent: number | null
  saleToListRecentPct: number | null
  /** Share of history sales the subject's sqft meets or beats (0-100). */
  subjectSqftPercentile: number | null
  vintageSpan: { min: number; max: number } | null
  source: string
}

export interface SubdivisionStory {
  facts: SubdivisionStoryFacts
  /** AI narrative sections (sanitized). Empty array when the pass did not run. */
  sections: Array<{ heading: string; body: string }>
  notableSales: SubdivisionNotableSale[]
  model: string | null
  costUsd: number | null
  photoSalesReviewed: number
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function addr(r: CmaSubdivisionHistoryRow): string {
  return `${r.StreetNumber ?? ''} ${r.StreetName ?? ''}`.trim() || 'unaddressed'
}

export function computeSubdivisionFacts(
  rows: CmaSubdivisionHistoryRow[],
  subdivision: string,
  subject: CmaSubject,
  sinceIso: string,
): SubdivisionStoryFacts | null {
  const sales = rows.filter((r) => Number.isFinite(Number(r.ClosePrice)) && Number(r.ClosePrice) > 0)
  if (sales.length < 5) return null
  const byYear = new Map<number, CmaSubdivisionHistoryRow[]>()
  for (const r of sales) {
    const y = Number(r.CloseDate?.slice(0, 4))
    if (!Number.isFinite(y)) continue
    byYear.set(y, [...(byYear.get(y) ?? []), r])
  }
  const years: SubdivisionYearFact[] = [...byYear.entries()]
    .map(([year, rs]) => ({
      year,
      count: rs.length,
      medianClose: Math.round(median(rs.map((r) => Number(r.ClosePrice)))!),
      medianPpsf: median(
        rs
          .filter((r) => Number(r.TotalLivingAreaSqFt) > 300)
          .map((r) => Number(r.ClosePrice) / Number(r.TotalLivingAreaSqFt)),
      ),
    }))
    .sort((a, b) => a.year - b.year)

  const sortedByPrice = [...sales].sort((a, b) => Number(a.ClosePrice) - Number(b.ClosePrice))
  const lo = sortedByPrice[0]
  const hi = sortedByPrice[sortedByPrice.length - 1]

  const twoYearsAgo = new Date(Date.now() - 2 * 365.25 * 24 * 3600e3).toISOString().slice(0, 10)
  const recent = sales.filter((r) => r.CloseDate >= twoYearsAgo)
  const domRecent = median(recent.map((r) => Number(r.CumulativeDaysOnMarket)).filter((n) => Number.isFinite(n) && n >= 0))
  const stl = recent
    .filter((r) => Number(r.ListPrice) > 0)
    .map((r) => Number(r.ClosePrice) / Number(r.ListPrice))
  const stlMed = median(stl)

  const sqfts = sales.map((r) => Number(r.TotalLivingAreaSqFt)).filter((n) => n > 300)
  let sqftPct: number | null = null
  if (subject.sqft != null && subject.sqft > 300 && sqfts.length >= 5) {
    sqftPct = Math.round((sqfts.filter((n) => n <= subject.sqft!).length / sqfts.length) * 100)
  }
  const vintages = sales.map((r) => Number(r.year_built)).filter((n) => n > 1900)

  return {
    name: subdivision,
    totalSales: sales.length,
    years,
    recordHigh: hi ? { price: Number(hi.ClosePrice), address: addr(hi), date: hi.CloseDate } : null,
    recordLow: lo ? { price: Number(lo.ClosePrice), address: addr(lo), date: lo.CloseDate } : null,
    medianDomRecent: domRecent,
    saleToListRecentPct: stlMed != null ? Math.round(stlMed * 1000) / 10 : null,
    subjectSqftPercentile: sqftPct,
    vintageSpan: vintages.length >= 5 ? { min: Math.min(...vintages), max: Math.max(...vintages) } : null,
    source: `Supabase listings, SubdivisionName='${subdivision}', PropertyType='A', Closed, CloseDate ≥ ${sinceIso}: ${sales.length} sales, aggregated by close year`,
  }
}

function computeCostUsd(inTok: number, outTok: number): number {
  return Math.round((inTok * INPUT_COST_PER_TOKEN + outTok * OUTPUT_COST_PER_TOKEN) * 10000) / 10000
}

const STORY_TOOL = {
  name: 'subdivision_story',
  description: 'The homeowner-facing story of this subdivision, grounded strictly on the provided facts.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sections: {
        type: 'array' as const,
        maxItems: 4,
        items: {
          type: 'object' as const,
          properties: {
            heading: { type: 'string' as const, description: 'Short sentence-case heading, no colon drama.' },
            body: {
              type: 'string' as const,
              description:
                'Two to four sentences. Second person (you, your street). ONLY numbers that appear verbatim in the FACTS block. Plain English, no marketing words.',
            },
          },
          required: ['heading', 'body'],
        },
      },
      notable_lines: {
        type: 'array' as const,
        maxItems: 4,
        items: {
          type: 'object' as const,
          properties: {
            list_number: { type: 'string' as const },
            line: {
              type: 'string' as const,
              description:
                'One sentence on what THIS sale shows about the street, grounded on its remarks or photo. No numbers unless copied verbatim from the sale line provided.',
            },
          },
          required: ['list_number', 'line'],
        },
      },
    },
    required: ['sections', 'notable_lines'],
  },
}

const STORY_SYSTEM =
  'You write the neighborhood section inside a Ryan Realty home-value report. The reader OWNS a home in this subdivision. ' +
  'The house voice is anchored on Warren Buffett\'s shareholder letters: write to one person, plain words, bad news before good, a number stated once and left alone. ' +
  'THE RULE THAT MATTERS MOST: state the fact, then stop. Never write a sentence that explains the sentence before it. If the reader could work it out from the number, they already have. ' +
  'HARD RULES: every number you write must appear VERBATIM in the FACTS or SALES lines provided. Never compute, round, or estimate a new number. ' +
  'Never coin a maxim or a balanced pair of clauses. Never phrase a number as something that speaks, tells, reveals, or proves a point. ' +
  'Never add a trailing clause that moralizes a fact. State the fact and stop, with no clause explaining why it matters. ' +
  'Never open with a windup ("Before the numbers...", "Let us take a look at..."). Start with the fact. ' +
  'Never praise the reader, the home, the neighborhood, or us. Never use: stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously, luxurious, immaculate, captivating, exquisite, delve, tapestry, robust, seamless, elevate, unlock, vibrant, bustling, curated, bespoke, hidden gem. ' +
  'Plain word over formal word: about not approximately, buy not purchase, home not residence, near not in close proximity to. Sentences run 15 to 20 words. ' +
  'No em dashes, no semicolons, no exclamation marks, no emoji. Address the reader as "you." ' +
  'What the section covers: how this street has traded by year, what kinds of homes sell here and at what prices, what the listing photos of recent sales show, and where the reader\'s home sits by size and vintage. ' +
  'When a photo grounds a claim, write "the listing photos show" so the source is clear. If a photo shows nothing worth reporting, write nothing about it.'

export async function generateSubdivisionStory(args: {
  subject: CmaSubject
  facts: SubdivisionStoryFacts
  rows: CmaSubdivisionHistoryRow[]
}): Promise<Pick<SubdivisionStory, 'sections' | 'notableSales' | 'model' | 'costUsd' | 'photoSalesReviewed'>> {
  const { subject, facts, rows } = args
  const withPhotos = rows.filter((r) => r.PhotoURL?.startsWith('https://')).slice(0, MAX_PHOTO_SALES)
  const notableBase: SubdivisionNotableSale[] = withPhotos.map((r) => ({
    listNumber: r.ListNumber,
    address: addr(r),
    closePrice: Number(r.ClosePrice),
    closeDate: r.CloseDate,
    sqft: Number(r.TotalLivingAreaSqFt) || null,
    photoUrl: r.PhotoURL,
    line: '',
  }))
  const empty = { sections: [], notableSales: notableBase, model: null, costUsd: null, photoSalesReviewed: 0 }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return empty

  const factsBlock = [
    `Subdivision: ${facts.name}`,
    `Total closed sales in window: ${facts.totalSales}`,
    ...facts.years.map(
      (y) => `Year ${y.year}: ${y.count} sales, median close $${y.medianClose.toLocaleString('en-US')}${y.medianPpsf ? `, median $${Math.round(y.medianPpsf)}/sqft` : ''}`,
    ),
    facts.recordHigh ? `Record high: $${facts.recordHigh.price.toLocaleString('en-US')} at ${facts.recordHigh.address} (${facts.recordHigh.date.slice(0, 10)})` : null,
    facts.recordLow ? `Record low: $${facts.recordLow.price.toLocaleString('en-US')} at ${facts.recordLow.address} (${facts.recordLow.date.slice(0, 10)})` : null,
    facts.medianDomRecent != null ? `Median days on market, last 2 years: ${Math.round(facts.medianDomRecent)}` : null,
    facts.saleToListRecentPct != null ? `Median sale-to-list, last 2 years: ${facts.saleToListRecentPct}%` : null,
    facts.subjectSqftPercentile != null ? `The reader's home is as large or larger than ${facts.subjectSqftPercentile}% of these sales` : null,
    facts.vintageSpan ? `Homes here were built ${facts.vintageSpan.min} to ${facts.vintageSpan.max}` : null,
    `Reader's home: ${subject.streetAddress}, ${subject.beds ?? '?'} bed, ${subject.baths ?? '?'} bath, ${subject.sqft ?? '?'} sqft, built ${subject.yearBuilt ?? '?'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const salesLines = rows
    .slice(0, 30)
    .map(
      (r) =>
        `MLS ${r.ListNumber ?? '?'} · ${addr(r)} · closed ${r.CloseDate.slice(0, 10)} at $${Number(r.ClosePrice).toLocaleString('en-US')} · ${r.TotalLivingAreaSqFt ?? '?'} sqft · built ${r.year_built ?? '?'}${r.public_remarks ? ` · remarks: ${String(r.public_remarks).slice(0, 260)}` : ''}`,
    )
    .join('\n')

  // The MLS CDN's robots.txt blocks Anthropic's URL fetcher (verified live
  // 2026-08-05), so photos are fetched HERE and passed as base64. A photo
  // that fails to download is simply skipped; the story still runs.
  const images: Array<{ row: CmaSubdivisionHistoryRow; block: Anthropic.Messages.ContentBlockParam }> = []
  for (const r of withPhotos) {
    try {
      const sized = sparkPhotoAt(r.PhotoURL, '800x600') ?? r.PhotoURL!
      const res = await fetch(sized, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg'
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0 || buf.length > 4_000_000) continue
      images.push({
        row: r,
        block: {
          type: 'image',
          source: { type: 'base64', media_type: mime as 'image/jpeg', data: buf.toString('base64') },
        },
      })
    } catch {
      /* skip this photo */
    }
  }

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: 'text',
      text: `FACTS (the only numbers you may use, verbatim):\n${factsBlock}\n\nSALES (newest first, remarks are the listing agent's own words, treat as descriptions not verified facts):\n${salesLines}\n\nThe images that follow are the MLS hero photos of the ${images.length} most recent sales, in the same order as these lines:\n${images.map((x, i) => `Photo ${i + 1}: MLS ${x.row.ListNumber ?? '?'} · ${addr(x.row)}`).join('\n')}`,
    },
    ...images.map((x) => x.block),
    {
      type: 'text',
      text: 'Write the subdivision story: 3 to 4 sections plus one line per photographed sale. Ground every claim in the lines and photos above.',
    },
  ]

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: STORY_SYSTEM,
      tools: [STORY_TOOL],
      tool_choice: { type: 'tool', name: 'subdivision_story' },
      messages: [{ role: 'user', content }],
    })
    const block = res.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return empty
    const out = block.input as {
      sections?: Array<{ heading?: string; body?: string }>
      notable_lines?: Array<{ list_number?: string; line?: string }>
    }
    const sections = (out.sections ?? [])
      .filter((s) => s.heading?.trim() && s.body?.trim())
      .slice(0, 4)
      .map((s) => ({ heading: sanitizeClientProse(s.heading!.trim()), body: sanitizeClientProse(s.body!.trim()) }))
    const lineByMls = new Map((out.notable_lines ?? []).map((n) => [String(n.list_number ?? ''), n.line ?? '']))
    const notableSales = notableBase.map((n) => ({
      ...n,
      line: sanitizeClientProse((lineByMls.get(String(n.listNumber ?? '')) ?? '').trim()),
    }))
    return {
      sections,
      notableSales,
      model: MODEL,
      costUsd: computeCostUsd(res.usage.input_tokens, res.usage.output_tokens),
      photoSalesReviewed: images.length,
    }
  } catch (err) {
    console.warn('[subdivision-story] AI pass failed open:', err instanceof Error ? err.message : err)
    return empty
  }
}

/** Orchestrator used by buildCma: facts always, story when the key allows. */
export async function buildSubdivisionStory(args: {
  subject: CmaSubject
  rows: CmaSubdivisionHistoryRow[]
  sinceIso: string
}): Promise<SubdivisionStory | null> {
  const subdivision = args.subject.subdivision?.trim()
  if (!subdivision) return null
  const facts = computeSubdivisionFacts(args.rows, subdivision, args.subject, args.sinceIso)
  if (!facts) return null
  const ai = await generateSubdivisionStory({ subject: args.subject, facts, rows: args.rows })
  return { facts, ...ai }
}
