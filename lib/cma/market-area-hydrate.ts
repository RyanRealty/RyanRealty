import 'server-only'
import { getCmaMarketAreaRows } from '@/lib/data/cma/marketAreaReads'
import { computeMarketArea } from '@/lib/cma/market-status'
import type { CmaExtras } from '@/lib/cma/extras'
import type { RenderCmaArgs } from '@/lib/cma/render'

const EMPTY_EXTRAS: CmaExtras = {
  seasonality: null,
  band: null,
  subdivisionPulse: null,
  financing: null,
  photoBench: null,
  marketArea: null,
}

/** Live market-area chapters on broker review. Does not write the row or change the price. */
export async function hydrateCmaMarketArea(args: RenderCmaArgs): Promise<RenderCmaArgs> {
  const since12 = new Date(Date.now() - 12 * 30.44 * 24 * 3600e3).toISOString().slice(0, 10)
  const rows = await getCmaMarketAreaRows(args.subject.city, since12).catch(() => [])
  const marketArea = computeMarketArea({
    rows,
    subject: args.subject,
    comps: args.comps,
    pricing: args.pricing,
  })
  return {
    ...args,
    extras: { ...(args.extras ?? EMPTY_EXTRAS), marketArea },
  }
}
