/**
 * Deduped listing-history → price path. The facts refresh runs the same rules
 * in SQL; this copy is the testable contract and the in-memory fallback.
 * reachability: entry-point testable contract for sale_pricing_price_steps SQL
 */

export type HistoryEvent = {
  eventDate: string
  event: string | null
  field: string | null
  previousValue: string | null
  newValue: string | null
  price: number | null
}

export type PriceStep = {
  eventDate: string
  dayFromList: number | null
  oldPrice: number
  newPrice: number
  changePct: number
}

export type SaleJourney = {
  originalAsk: number | null
  lastAsk: number | null
  closePrice: number
  saleToOriginal: number | null
  saleToFinal: number | null
  firstDropDay: number | null
  dropCount: number
  pendingDate: string | null
  daysToOffer: number | null
  steps: PriceStep[]
}

function money(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function dayDiff(from: string | null, to: string): number | null {
  if (!from) return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 86_400_000)
}

function dedupeKey(e: HistoryEvent): string {
  return [
    e.eventDate.slice(0, 10),
    e.field ?? '',
    e.previousValue ?? '',
    e.newValue ?? '',
  ].join('|')
}

export function buildSaleJourney(opts: {
  events: HistoryEvent[]
  originalListPrice: number | null
  lastListPrice: number | null
  closePrice: number
  onMarketDate: string | null
  pendingTimestamp: string | null
}): SaleJourney {
  const seen = new Set<string>()
  const events = [...opts.events]
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .filter((e) => {
      const k = dedupeKey(e)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

  const steps: PriceStep[] = []
  for (const e of events) {
    if ((e.field ?? '').toLowerCase() !== 'listprice') continue
    const oldPrice = money(e.previousValue)
    const newPrice = money(e.newValue) ?? money(e.price)
    if (!oldPrice || !newPrice || oldPrice === newPrice) continue
    steps.push({
      eventDate: e.eventDate.slice(0, 10),
      dayFromList: dayDiff(opts.onMarketDate, e.eventDate),
      oldPrice,
      newPrice,
      changePct: +((newPrice - oldPrice) / oldPrice).toFixed(4),
    })
  }

  let pendingDate = opts.pendingTimestamp ? opts.pendingTimestamp.slice(0, 10) : null
  for (const e of events) {
    const field = (e.field ?? '').toLowerCase()
    const next = (e.newValue ?? '').toLowerCase()
    if (field === 'pendingdate' && e.newValue) {
      pendingDate = e.newValue.slice(0, 10)
      break
    }
    if ((field === 'mlsstatus' || field === 'standardstatus') && /pending|under contract/.test(next)) {
      pendingDate = e.eventDate.slice(0, 10)
      break
    }
  }

  const firstListFromHistory = steps[0]?.oldPrice ?? null
  const originalAsk = opts.originalListPrice ?? firstListFromHistory ?? opts.lastListPrice
  const lastAsk = steps.length ? steps[steps.length - 1]!.newPrice : opts.lastListPrice ?? originalAsk
  const drops = steps.filter((s) => s.newPrice < s.oldPrice)
  const close = opts.closePrice
  return {
    originalAsk,
    lastAsk,
    closePrice: close,
    saleToOriginal: originalAsk ? +(close / originalAsk).toFixed(4) : null,
    saleToFinal: lastAsk ? +(close / lastAsk).toFixed(4) : null,
    firstDropDay: drops[0]?.dayFromList ?? null,
    dropCount: drops.length,
    pendingDate,
    daysToOffer: dayDiff(opts.onMarketDate, pendingDate ?? ''),
    steps,
  }
}
