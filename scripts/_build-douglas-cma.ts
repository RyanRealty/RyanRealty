/**
 * Draft CMA for 648 SE Douglas St, Bend (Clear Sky Estates).
 * Mirrors buildCmaAdminAction — writable slot, draft only, cannot send.
 *   npx tsx scripts/_build-douglas-cma.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { mkdirSync, writeFileSync } from 'node:fs'
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

const MLS = '220126412'
const ADDRESS = '648 SE Douglas St, Bend, OR 97702'
const OUT = path.resolve('out/cma-648-se-douglas')

const ZILLOW = {
  url: 'https://www.zillow.com/homedetails/648-SE-Douglas-St-Bend-OR-97702/60583914_zpid/',
  fetchedAt: '2026-08-17',
  zestimate: 474100,
  rangeLow: 450000,
  rangeHigh: 498000,
  publishedComps: [
    { address: '947 SE 6th St', soldPrice: 495000, beds: 3, baths: 1, sqft: 1036, mlsNumber: '220222218', zillowStatus: 'sold' as const },
    { address: '801 SE Polaris Ct', soldPrice: 495000, beds: 3, baths: 1, sqft: 1036, mlsNumber: '220204222', zillowStatus: 'sold' as const },
    { address: '1627 SE Bear Creek Rd', soldPrice: 477500, beds: 3, baths: 2, sqft: 1040, mlsNumber: '220222238', zillowStatus: 'sold' as const },
    { address: '1540 NE Bear Creek Rd', soldPrice: 469000, beds: 2, baths: 1, sqft: 1032, mlsNumber: '220215591', zillowStatus: 'sold' as const },
    { address: '504 NE Dekalb Ave', soldPrice: 425000, beds: 3, baths: 1, sqft: 960, mlsNumber: null, zillowStatus: 'sold' as const },
  ],
}

async function renderOnly() {
  const { getCmaAdminRowBySlug, updateCmaRowFieldsBySlug, getCmaBrokerBySlugOrEmail } = await import('@/lib/data')
  const { findCmaListingsByMlsNumbers } = await import('@/lib/data/cma/builderReads')
  const { renderCmaHtml } = await import('@/lib/cma/render')
  const { listingToMlsFact } = await import('@/lib/cma/extras')
  const { bustZestimate, mergeMlsFacts, mlsFactsFromPricedComps } = await import('@/lib/cma/zestimate-buster')
  const { buildCmaMapDataUri } = await import('@/lib/cma/map')
  const { resolveParcelRecord } = await import('@/lib/cma/parcel-record')
  const { resolvePurchaseMortgageAssumption } = await import('@/lib/cma/mortgage-assumption')
  const { buildSellerProceeds } = await import('@/lib/cma/seller-proceeds')

  const row = await getCmaAdminRowBySlug('cma-648-se-douglas')
  if (!row) throw new Error('no draft row')
  const stored = (row as { render_args?: Record<string, unknown> }).render_args
  if (!stored || typeof stored !== 'object') throw new Error('no render_args')
  const comps = stored.comps as Parameters<typeof mlsFactsFromPricedComps>[0]
  const pricing = stored.pricing as { recommended: number; conservative: number; highEnd: number }
  const subject = stored.subject as { beds: number | null; baths: number | null; sqft: number | null; yearBuilt: number | null }
  const mlsNumbers = ZILLOW.publishedComps.map((c) => c.mlsNumber).filter((n): n is string => Boolean(n))
  const lookedUp = await findCmaListingsByMlsNumbers(mlsNumbers).catch(() => [])
  const bust = bustZestimate({
    snapshot: ZILLOW,
    mls: mergeMlsFacts(mlsFactsFromPricedComps(comps), lookedUp.map(listingToMlsFact)),
    subject,
    recommended: pricing.recommended,
    conservative: pricing.conservative,
    highEnd: pricing.highEnd,
    asOf: '2026-08-17',
    ownerNotes: [
      'Interior and exterior repainted',
      'New solid surface countertops',
      'Bathroom remodel',
    ],
  })
  const equity = stored.equity as { purchasePrice?: number; purchaseDate?: string } | null
  const parcel = await resolveParcelRecord(stored.subject as never).catch(() => null)
  const purchasePrice = parcel?.acquiredAt ?? equity?.purchasePrice ?? null
  const purchaseDate = parcel?.ownedSince ?? equity?.purchaseDate ?? null
  const mortgage =
    purchasePrice != null && purchaseDate
      ? await resolvePurchaseMortgageAssumption({
          purchasePrice,
          purchaseDate,
          asOf: new Date('2026-08-17'),
        }).catch(() => null)
      : null
  const proceeds = buildSellerProceeds({
    pricing: pricing as never,
    parcel,
    mortgage,
  })
  const extras = { ...((stored.extras as object) ?? {}), zillow: bust, parcel, proceeds }
  const nextArgs = { ...stored, extras }
  const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: 'matthew-ryan' })
  if (!brokerRow) throw new Error('no broker')
  const broker = {
    id: (brokerRow.id as string) ?? null,
    slug: (brokerRow.slug as string) ?? 'matthew-ryan',
    displayName: (brokerRow.display_name as string) || '',
    title: (brokerRow.title as string) || 'Broker',
    licenseNumber: (brokerRow.license_number as string | null) ?? null,
    email: (brokerRow.email as string | null) ?? null,
    phone: (brokerRow.twilio_number as string | null) ?? null,
    photoUrl: (brokerRow.photo_url as string | null) ?? null,
  }
  let mapDataUri: string | null = null
  try {
    const map = await buildCmaMapDataUri(stored.subject as never, stored.comps as never, {
      tiersUsed: stored.tiersUsed as string[] | undefined,
    })
    mapDataUri = map?.dataUri ?? null
  } catch {
    mapDataUri = null
  }
  const { html, pageCount } = renderCmaHtml({ ...nextArgs, broker, mapDataUri } as never)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(path.join(OUT, 'cma.html'), html)
  const saved = await updateCmaRowFieldsBySlug('cma-648-se-douglas', {
    html_content: html,
    render_args: nextArgs,
  }, { onlyWhenStatus: 'draft' })
  if (!saved.ok) throw new Error(saved.error ?? 'update failed')
  console.log(`✓ re-rendered cma-648-se-douglas (${pageCount} pages)`)
  console.log(JSON.stringify({
    heading: bust?.heading,
    usable: bust?.usableCount,
    dirty: bust?.dirtyCount,
    grades: bust?.grades.map((g) => `${g.address}: ${g.grade}`),
    lookedUp: lookedUp.length,
  }, null, 2))
}

async function main() {
  if (process.argv.includes('--render-only')) {
    await renderOnly()
    return
  }
  const { slugifyAddress } = await import('@/lib/cma/address-slug')
  const { resolveWritableCmaSlot, getLatestCmaRowForBaseSlug } = await import('@/lib/cma/versions')
  const { buildCma } = await import('@/lib/cma/build')

  const baseSlug = slugifyAddress(ADDRESS)
  const latest = await getLatestCmaRowForBaseSlug(baseSlug)
  console.log(`base slug: ${baseSlug}`)
  if (latest) {
    console.log(
      `existing: ${latest.slug} status=${String(latest.row.status ?? '')} recommended=${String(latest.row.recommended_list ?? '')}`,
    )
  } else {
    console.log('existing: none')
  }

  const slot = await resolveWritableCmaSlot(baseSlug)
  if (!slot.ok) {
    console.error(`✖ slot: ${slot.error}`)
    process.exit(1)
  }
  console.log(`writable slot: ${slot.slug}${slot.existing ? ' (rebuild draft)' : ' (new row)'}`)

  const started = Date.now()
  const result = await buildCma({
    slug: slot.slug,
    mlsNumber: MLS,
    rawAddress: ADDRESS,
    city: 'Bend',
    postalCode: '97702',
    client: {
      name: null,
      email: null,
      phone: null,
      notes: 'Draft subject switch from Quince. RPR density + county ownership. Not sent.',
    },
    ownerNotes: [
      'Interior and exterior repainted',
      'New solid surface countertops',
      'Bathroom remodel',
    ],
    zillow: ZILLOW,
    brokerSlug: 'matthew-ryan',
    requestSource: 'cli-douglas-draft',
    docType: 'cma',
  })

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (!result.ok) {
    console.error(`✖ build failed after ${secs}s: ${result.error}`)
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })
  if (result.html) writeFileSync(path.join(OUT, 'cma.html'), result.html)
  const extras = (result as { extras?: { parcel?: { agentNotes?: string[]; sales?: unknown[]; permits?: unknown[] } } })
    .extras
  const summary = {
    slug: result.slug,
    cmaId: result.cmaId,
    seconds: Number(secs),
    pageCount: result.pageCount ?? null,
    subject: result.subject
      ? {
          address: result.subject.streetAddress,
          city: result.subject.city,
          subdivision: result.subject.subdivision,
          mls: result.subject.mlsNumber,
          beds: result.subject.beds,
          baths: result.subject.baths,
          sqft: result.subject.sqft,
          yearBuilt: result.subject.yearBuilt,
          lastListPrice: result.subject.lastListPrice,
          status: result.subject.standardStatus,
        }
      : null,
    market: result.market
      ? {
          geoLabel: result.market.geoLabel,
          monthsOfSupply: result.market.monthsOfSupply,
          marketVerdict: result.market.marketVerdict,
          medianSalePrice: result.market.medianSalePrice,
          methodologyVersion: result.market.methodologyVersion,
        }
      : null,
    pricing: result.pricing
      ? {
          recommended: result.pricing.recommended,
          valueLow: result.pricing.valueLow,
          valueHigh: result.pricing.valueHigh,
          predictedClose: result.pricing.predictedClose,
        }
      : null,
    comps: (result.comps ?? []).map((c) => ({
      address: c.address,
      mls: c.mlsNumber,
      close: c.closePrice,
      beds: c.beds,
      baths: c.baths,
      sqft: c.sqft,
      yearBuilt: c.yearBuilt,
      keepTier: c.keepTier ?? null,
    })),
    parcel: extras?.parcel
      ? {
          sales: extras.parcel.sales?.length ?? 0,
          permits: extras.parcel.permits?.length ?? 0,
          agentNotes: extras.parcel.agentNotes ?? [],
        }
      : null,
    banned: result.html
      ? {
          marketing: /how we would market|what we would do/i.test(result.html),
          confidence: /High confidence|Moderate confidence|Confidence:/i.test(result.html),
          zipLine: /not the (whole )?ZIP/i.test(result.html),
          ownership: /Who has owned this house/.test(result.html),
          productClass: /same .+ search as the sales that set the number/.test(result.html),
          sold90Dump: /What 3-bedroom, 1-bath homes sold for/.test(result.html),
          cityDump: /2 to 4 bedroom(?!, 1-bath)/.test(result.html),
          labeledYAxis: /text-anchor="end"/.test(result.html),
        }
      : null,
    adminUrl: `https://ryan-realty.com/admin/cmas/${result.slug}`,
    localHtml: path.join(OUT, 'cma.html'),
  }
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(`✓ draft ${result.slug} in ${secs}s`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  console.error('✖ build threw:', e)
  process.exit(1)
})
