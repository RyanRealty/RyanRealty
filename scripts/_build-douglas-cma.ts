/**
 * Draft CMA for 648 SE Douglas St, Bend (Clear Sky Estates).
 *   npx tsx scripts/_build-douglas-cma.ts
 *   npx tsx scripts/_build-douglas-cma.ts --from-stored
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

function writePreview(printHtml: string, webHtml: string) {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(path.join(OUT, 'cma.html'), printHtml)
  writeFileSync(path.join(OUT, 'cma-web.html'), webHtml)
}

async function rerenderFromStored(): Promise<void> {
  const { slugifyAddress } = await import('@/lib/cma/address-slug')
  const { getLatestCmaRowForBaseSlug } = await import('@/lib/cma/versions')
  const { getCmaBrokerBySlugOrEmail, updateCmaRowFieldsBySlug } = await import('@/lib/data')
  const { renderCmaHtml } = await import('@/lib/cma/render')
  type RenderCmaArgs = import('@/lib/cma/render').RenderCmaArgs
  const { renderImmersiveCmaHtml } = await import('@/lib/cma/immersive')
  const { applyCompVerdicts, verdictsFromBuildSummary } = await import('@/lib/cma/client-facing')
  const { buildCmaExtras } = await import('@/lib/cma/extras')
  const { keepSameProductType } = await import('@/lib/cma/market-area')
  const mapFromHtml = (html: string | null): string | null => {
    if (!html) return null
    const hit =
      /<img\b[^>]*\bclass="[^"]*\bpin-map\b[^"]*"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html) ??
      /<img\b[^>]*\bclass="[^"]*\bmap-img\b[^"]*"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html) ??
      /<img\b[^>]*\balt="Comparable sales map"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html)
    return hit?.[1] ?? null
  }

  const latest = await getLatestCmaRowForBaseSlug(slugifyAddress(ADDRESS))
  if (!latest) {
    console.error('✖ no stored CMA for this address')
    process.exit(1)
  }
  const row = latest.row
  const stored = row.render_args as RenderCmaArgs | null
  if (!stored?.pricing) {
    console.error('✖ stored row has no render_args')
    process.exit(1)
  }

  const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: String(row.broker_slug ?? 'matthew-ryan') })
  const broker = {
    id: (brokerRow?.id as string) ?? null,
    slug: (brokerRow?.slug as string) ?? 'matthew-ryan',
    displayName: (brokerRow?.display_name as string) || 'Matt Ryan',
    title: (brokerRow?.title as string) || 'Owner & Principal Broker',
    licenseNumber: (brokerRow?.license_number as string | null) ?? null,
    email: (brokerRow?.email as string | null) ?? null,
    phone: (brokerRow?.twilio_number as string | null) ?? null,
    photoUrl: (brokerRow?.photo_url as string | null) ?? null,
  }
  const comps = applyCompVerdicts(stored.comps ?? [], verdictsFromBuildSummary(row.build_summary))
  const mapDataUri = mapFromHtml(typeof row.html_content === 'string' ? row.html_content : null)
  const bandNote =
    'List band is $465,000 to $495,000 so the ask sits with recent neighborhood sales at $495,000. Expected close stays $452,000.'
  const pricing = {
    ...stored.pricing,
    conservative: 465000,
    highEnd: 495000,
    notes: [...(stored.pricing.notes ?? []).filter((n) => !/List band is \$465,000/.test(n)), bandNote],
  }
  const extras = await buildCmaExtras({
    subject: stored.subject,
    comps,
    pricing,
    subjectPhotosCount: stored.extras?.photoBench?.subjectPhotos ?? null,
  })
  if (extras.band?.rivals) {
    extras.band.rivals = extras.band.rivals.filter((r) =>
      keepSameProductType(stored.subject.propertySubType, r.propertySubType ?? null),
    )
  }
  const args = { ...stored, comps, broker, mapDataUri, pricing, extras }
  const { html, pageCount } = renderCmaHtml(args)
  const web = renderImmersiveCmaHtml({ ...args, broker }, process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com')
  writePreview(html, web)
  const { mapDataUri: _drop, broker: _b, ...persistArgs } = args
  const saved = await updateCmaRowFieldsBySlug(latest.slug, {
    html_content: html,
    render_args: persistArgs,
  })
  console.log(
    JSON.stringify(
      {
        slug: latest.slug,
        pageCount,
        storedHtmlUpdated: saved.ok,
        predictedClose: pricing.predictedClose,
        recommended: pricing.recommended,
        listLow: pricing.conservative,
        listHigh: pricing.highEnd,
        localPrint: path.join(OUT, 'cma.html'),
        localWeb: path.join(OUT, 'cma-web.html'),
      },
      null,
      2,
    ),
  )
}

async function main() {
  if (process.argv.includes('--from-stored')) {
    await rerenderFromStored()
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
      notes: 'Draft. Seller CMA. Not sent.',
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
  if (result.html) {
    const { renderImmersiveCmaHtml } = await import('@/lib/cma/immersive')
    const { getCmaBrokerBySlugOrEmail } = await import('@/lib/data')
    const { getLatestCmaRowForBaseSlug: reload } = await import('@/lib/cma/versions')
    type RenderCmaArgs = import('@/lib/cma/render').RenderCmaArgs
    const brokerRow = await getCmaBrokerBySlugOrEmail({ slug: 'matthew-ryan' })
    const broker = {
      id: (brokerRow?.id as string) ?? null,
      slug: 'matthew-ryan',
      displayName: (brokerRow?.display_name as string) || 'Matt Ryan',
      title: (brokerRow?.title as string) || 'Owner & Principal Broker',
      licenseNumber: (brokerRow?.license_number as string | null) ?? null,
      email: (brokerRow?.email as string | null) ?? null,
      phone: (brokerRow?.twilio_number as string | null) ?? null,
      photoUrl: (brokerRow?.photo_url as string | null) ?? null,
    }
    const mapHit =
      /<img\b[^>]*\bclass="[^"]*\bpin-map\b[^"]*"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(result.html) ??
      /<img\b[^>]*\balt="Comparable sales map"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(result.html)
    const stored = (await reload(baseSlug))?.row.render_args as RenderCmaArgs | null
    const web = renderImmersiveCmaHtml(
      {
        ...(stored ?? {
          subject: result.subject!,
          comps: result.comps ?? [],
          market: result.market ?? null,
          pricing: result.pricing!,
          client: { name: null, email: null, phone: null, notes: 'Draft. Seller CMA. Not sent.' },
          generatedAtIso: new Date().toISOString(),
          subjectTrace: '',
          compTrace: [],
          excludedOutliers: [],
        }),
        broker,
        mapDataUri: mapHit?.[1] ?? null,
      },
      process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com',
    )
    writePreview(result.html, web)
  }
  const summary = {
    slug: result.slug,
    seconds: Number(secs),
    pageCount: result.pageCount ?? null,
    subject: result.subject
      ? {
          address: result.subject.streetAddress,
          status: result.subject.standardStatus,
          lastListPrice: result.subject.lastListPrice,
          lastListDate: result.subject.lastListDate,
        }
      : null,
    pricing: result.pricing
      ? {
          recommended: result.pricing.recommended,
          conservative: result.pricing.conservative,
          highEnd: result.pricing.highEnd,
          predictedClose: result.pricing.predictedClose,
          method3: result.pricing.method3,
          notes: result.pricing.notes.slice(0, 4),
        }
      : null,
    comps: (result.comps ?? []).map((c) => ({
      address: c.address,
      mls: c.mlsNumber,
      close: c.closePrice,
      adjusted: c.adjustedPrice,
    })),
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
