/**
 * lib/agent/tools/comps.ts — the `comps` tool (R2.2).
 *
 * Thin wrapper over selectCmaCompsPool (lib/data/cma/builderReads.ts) — the
 * same closed-comp read the CMA builder itself uses, so a quick conversational
 * "what do comps look like" answer never drifts from the real CMA math. The
 * full CMA build (subject resolution, adjustments, judge pass) stays with the
 * create_action/run_now tools (produce.ts, a different worker's file) — this
 * tool is a fast read, not a build.
 */
import { selectCmaCompsPool } from '@/lib/data/cma/builderReads'
import type { AgentContext, AgentCitation, AgentTool, ToolOutcome } from '@/lib/agent/types'

const DEFAULT_MONTHS_BACK = 12
const SQFT_BAND = 0.2 // +/-20% around the given square footage

function monthsAgoIso(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

async function compsHandler(input: Record<string, unknown>, _ctx: AgentContext): Promise<ToolOutcome> {
  const city = typeof input.city === 'string' ? input.city.trim() : ''
  const sqft = Number(input.sqft)
  if (!city || !Number.isFinite(sqft) || sqft <= 0) {
    return { result: { error: 'city and sqft are required' } }
  }

  const monthsBackInput = Number(input.monthsBack)
  const monthsBack = Number.isFinite(monthsBackInput) && monthsBackInput > 0 ? monthsBackInput : DEFAULT_MONTHS_BACK
  const limitInput = Number(input.limit)
  const limit = Math.min(Math.max(Number.isFinite(limitInput) ? Math.round(limitInput) : 20, 1), 50)
  const sqftMin = Math.round(sqft * (1 - SQFT_BAND))
  const sqftMax = Math.round(sqft * (1 + SQFT_BAND))
  const closeDateGte = monthsAgoIso(monthsBack)

  const rows = await selectCmaCompsPool({ cityIlike: city, closeDateGte, sqftMin, sqftMax, limit })

  const comps = rows.map((row) => {
    const r = row as Record<string, unknown>
    const closePrice = r.ClosePrice != null ? Number(r.ClosePrice) : null
    const livingArea = r.TotalLivingAreaSqFt != null ? Number(r.TotalLivingAreaSqFt) : null
    return {
      address: [r.StreetNumber, r.StreetName].filter(Boolean).join(' '),
      closeDate: (r.CloseDate as string | null) ?? null,
      closePrice,
      sqft: livingArea,
      pricePerSqft: closePrice && livingArea ? Math.round(closePrice / livingArea) : null,
      beds: r.BedroomsTotal != null ? Number(r.BedroomsTotal) : null,
      baths: r.BathroomsTotal != null ? Number(r.BathroomsTotal) : null,
    }
  })

  const citations: AgentCitation[] = [
    {
      figure: `${comps.length} comps`,
      source: `listings via selectCmaCompsPool, Closed+PropertyType=A, City ILIKE ${city}, CloseDate>=${closeDateGte}, sqft ${sqftMin}-${sqftMax}, rows=${comps.length}`,
    },
  ]

  if (comps.length === 0) {
    return {
      result: {
        comps: [],
        note: 'Thin or empty comp pool at this city/sqft/window. State that honestly and offer to widen the search — never pad a pool to look confident.',
      },
      citations,
    }
  }

  return { result: { comps, criteria: { city, sqftMin, sqftMax, closeDateGte } }, citations }
}

export const compsTools: AgentTool[] = [
  {
    name: 'comps',
    description:
      'Closed SFR comps (last 12 months by default) within +/-20% of a given square footage, in one city. For a quick conversational comps answer, not the full CMA build.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        sqft: { type: 'number', description: 'Subject square footage — comps are searched in a band around this.' },
        monthsBack: { type: 'number', description: 'Closed-sale lookback window in months. Default 12.' },
        limit: { type: 'number', description: 'Max comps. Default 20, capped 50.' },
      },
      required: ['city', 'sqft'],
    },
    handler: compsHandler,
  },
]
