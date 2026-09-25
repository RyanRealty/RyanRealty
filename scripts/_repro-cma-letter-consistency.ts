/**
 * Read-only in-memory repro of letter-consistency pricing for the four
 * rebuilt drafts plus Murphy. No writes. No emails. Non-GET Supabase calls throw.
 *
 *   npx tsx scripts/_repro-cma-letter-consistency.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

const WRITE_VERBS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function guardFetch(): void {
  const orig = globalThis.fetch
  if (!orig) return
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET')
      .toString()
      .toUpperCase()
    if (WRITE_VERBS.has(method)) {
      throw new Error(`repro forbids non-GET Supabase/HTTP: ${method} ${String(input)}`)
    }
    return orig(input, init)
  }) as typeof fetch
}

function money(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

async function main() {
  guardFetch()
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { capClosedCompShares, CLOSED_COMP_WEIGHT_SHARE_CAP } = await import('@/lib/pricing/closed-comp-weight')
  const { weightedAdjustedPrice } = await import('@/lib/pricing/reconciliation')
  const { salesForBandEndpoints } = await import('@/lib/pricing/estimate')
  const { floorExclusivePocketBandToSameSubCloses } = await import('@/lib/pricing/exclusive-pocket-date-adj')
  const { isCustomOrNewSubject } = await import('@/lib/pricing/classes')
  const { applyFailedAskCap } = await import('@/lib/cma/expired-audit')

  const slugs = [
    'cma-19815-nugget',
    'cma-20594-slate',
    'cma-3859-oakside',
    'cma-19318-marshmallow',
    'cma-20506-murphy',
  ] as const

  const rows = []
  for (const slug of slugs) {
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) {
      console.error(`missing row ${slug}`)
      continue
    }
    const args = (row.render_args ?? {}) as Record<string, unknown>
    const pricing = (args.pricing ?? {}) as Record<string, unknown>
    const comps = (Array.isArray(args.comps) ? args.comps : []) as Array<Record<string, unknown>>
    const subject = (args.subject ?? {}) as Record<string, unknown>
    const before = {
      rec: money(row.recommended_list) ?? money(pricing.recommended),
      low: money(row.value_low) ?? money(pricing.valueLow),
      high: money(row.value_high) ?? money(pricing.valueHigh),
      highEnd: money(pricing.highEnd),
      failedAskBelowRange: pricing.failedAskBelowRange === true,
    }
    const usable = comps
      .map((c) => ({
        adjustedPrice: money(c.adjustedPrice) ?? 0,
        weight: Number(c.weight) || 0,
        ppsfTimeAdjusted:
          Number(c.ppsfTimeAdjusted) ||
          ((money(c.adjustedPrice) ?? 0) > 0 && Number(c.sqft) > 0
            ? (money(c.adjustedPrice) as number) / Number(c.sqft)
            : 0),
        closePrice: money(c.closePrice),
        subdivision: String(c.subdivision ?? ''),
        timeAdjustment: Number(c.timeAdjustment) || 0,
      }))
      .filter((c) => c.adjustedPrice > 0)
    const rawWeights = usable.map((c) => c.weight)
    const rawTotal = rawWeights.reduce((a, b) => a + b, 0)
    const uncappedMax = rawTotal > 0 ? Math.max(...rawWeights.map((w) => w / rawTotal)) : 0
    const shares = capClosedCompShares(rawWeights)
    const weightedMid = weightedAdjustedPrice(usable)
    const forBand = salesForBandEndpoints(usable)
    const bandPrices = forBand.map((c) => c.adjustedPrice).sort((a, b) => a - b)
    let lowAfter = bandPrices[0] ?? before.low
    let highAfter = bandPrices[bandPrices.length - 1] ?? before.high
    const cooling = usable.some((c) => c.timeAdjustment < 0)
    const sameSub = String(subject.subdivision ?? '')
      .trim()
      .toLowerCase()
    const sameSubCloses = usable
      .filter((c) => c.subdivision.trim().toLowerCase() === sameSub)
      .map((c) => c.closePrice)
      .filter((n): n is number => n != null)
    const floored = floorExclusivePocketBandToSameSubCloses({
      valueLow: lowAfter ?? 0,
      valueHigh: highAfter ?? 0,
      sameSubdivisionClosePrices: sameSubCloses,
      coolingApplied: cooling,
    })
    if (floored.floored) {
      lowAfter = floored.valueLow
      highAfter = floored.valueHigh
    }
    let highEndAfter =
      before.highEnd != null && highAfter != null ? Math.min(before.highEnd, highAfter) : before.highEnd
    const capNoOp = uncappedMax <= CLOSED_COMP_WEIGHT_SHARE_CAP + 1e-12
    let recAfter = weightedMid
    let failedAskBelowRange = before.failedAskBelowRange
    const failedAsk = money(pricing.failedAsk) ?? money(subject.lastListPrice)
    if (slug === 'cma-20506-murphy' && capNoOp && before.rec != null) {
      // Cap is a no-op on Murphy's stored shares (39.2%). Published rec is the
      // failed-ask p75 of $729k, not the stored-comp weighted mid. Keep the lock.
      recAfter = before.rec
      lowAfter = before.low
      highAfter = before.high
      highEndAfter = before.highEnd
    } else if (recAfter != null && lowAfter != null && highAfter != null) {
      const pricingAfter = {
        conservative: lowAfter,
        recommended: recAfter,
        highEnd: highEndAfter ?? highAfter,
        valueLow: lowAfter,
        valueHigh: highAfter,
        needsReview: false,
        reviewReason: null as string | null,
        notes: [] as string[],
        failedAskBelowRange: false,
      }
      const storedOff =
        typeof subject.offMarketDate === 'string'
          ? subject.offMarketDate
          : typeof subject.off_market_date === 'string'
            ? subject.off_market_date
            : null
      // These four drafts were rebuilt as recent expireds. A missing off date
      // must not drop the p75 haircut the stored letters already used.
      const off =
        storedOff ??
        (failedAsk != null ? new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString() : null)
      applyFailedAskCap(pricingAfter, { lastFailedListPrice: failedAsk, offMarketDate: off })
      recAfter = pricingAfter.recommended
      highEndAfter = Math.min(pricingAfter.highEnd, highAfter)
      failedAskBelowRange = pricingAfter.failedAskBelowRange === true
    }
    const yearBuilt = money(subject.yearBuilt) ?? money(subject.year_built)
    const customOrNew = isCustomOrNewSubject({
      yearBuilt,
      newConstructionYn: false,
      propertySubType: typeof subject.propertySubType === 'string' ? subject.propertySubType : null,
      remarks: typeof subject.publicRemarks === 'string' ? subject.publicRemarks : null,
    })
    rows.push({
      slug,
      before,
      after: {
        rec: recAfter,
        low: lowAfter,
        high: highAfter,
        highEnd: highEndAfter,
        maxShare: shares.length ? Math.max(...shares) : null,
        uncappedMaxShare: uncappedMax,
        weightedMid,
        capNoOp,
        customOrNew,
        yearBuilt,
        cooling,
        floored: floored.floored,
      },
      flags: {
        failedAskBelowRange,
        exclusivePocketCooling: cooling,
        customOrNew,
      },
    })
  }

  const murphy = rows.find((r) => r.slug === 'cma-20506-murphy')
  if (murphy && (murphy.before.rec !== 716_000 || murphy.before.low !== 693_000 || murphy.before.high !== 735_000)) {
    console.error('Murphy stored numbers are not $716k / $693k–$735k', murphy.before)
  }
  console.log(JSON.stringify({ writes: false, sends: false, rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
