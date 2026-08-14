/**
 * One-off: draft CMA for 56628 Sunstone Loop (Caldera Springs).
 *
 * Mirrors buildCmaAdminAction — writable slot, draft only, cannot send.
 *   npx tsx scripts/_build-sunstone-cma.ts
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

const MLS = '220197955'
const ADDRESS = '56628 Sunstone Loop, Bend, OR 97707'
const OUT = path.resolve('out/cma-56628-sunstone')

async function resolveClient(): Promise<{
  name: string
  email: string | null
  phone: string | null
  personId: number | null
}> {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id, name, emails, phones, addresses')
    .eq('deleted', false)
    .ilike('name', '%chris%')
    .limit(50)
  if (error) {
    console.warn('CRM name probe failed:', error.message)
  }
  const rows = (data ?? []) as Array<{
    id: number
    name: string | null
    emails: Array<{ value?: string; isPrimary?: number | boolean }> | null
    phones: Array<{ value?: string; isPrimary?: number | boolean }> | null
    addresses: unknown
  }>
  const hit =
    rows.find((p) => JSON.stringify(p.addresses ?? '').toLowerCase().includes('sunstone')) ?? null
  if (!hit) {
    return { name: 'Chris', email: null, phone: null, personId: null }
  }
  const emails = hit.emails ?? []
  const phones = hit.phones ?? []
  const email =
    emails
      .slice()
      .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]
      ?.value?.trim()
      .toLowerCase() ?? null
  const phone =
    phones
      .slice()
      .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value?.trim() ?? null
  return {
    name: hit.name?.trim() || 'Chris',
    email,
    phone,
    personId: hit.id,
  }
}

async function main() {
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

  const client = await resolveClient()
  console.log(
    `client: ${client.name}${client.personId != null ? ` crm#${client.personId}` : ''}${client.email ? ` <${client.email}>` : ''}`,
  )

  const started = Date.now()
  const result = await buildCma({
    slug: slot.slug,
    mlsNumber: MLS,
    rawAddress: ADDRESS,
    city: 'Bend',
    postalCode: '97707',
    client: {
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: 'Draft for comparison with the RPR packet dated 2026-08-12. Not sent.',
    },
    brokerSlug: 'matthew-ryan',
    requestSource: 'cli-sunstone-draft',
    docType: 'cma',
  })

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (!result.ok) {
    console.error(`✖ build failed after ${secs}s: ${result.error}`)
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })
  if (result.html) writeFileSync(path.join(OUT, 'cma.html'), result.html)
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
          lotAcres: result.subject.lotAcres,
          yearBuilt: result.subject.yearBuilt,
          lastListPrice: result.subject.lastListPrice,
          status: result.subject.standardStatus,
        }
      : null,
    market: result.market
      ? {
          geoLabel: result.market.geoLabel,
          geoSlug: result.market.geoSlug,
          monthsOfSupply: result.market.monthsOfSupply,
          marketVerdict: result.market.marketVerdict,
          medianSalePrice: result.market.medianSalePrice,
          soldCount365: result.market.soldCount365,
          activeCount: result.market.activeCount,
          pendingCount: result.market.pendingCount,
          methodologyVersion: result.market.methodologyVersion,
          trendMonths: result.market.trend?.length ?? 0,
        }
      : null,
    pricing: result.pricing
      ? {
          recommended: result.pricing.recommended,
          valueLow: result.pricing.valueLow,
          valueHigh: result.pricing.valueHigh,
          confidence: result.pricing.confidence,
        }
      : null,
    comps: (result.comps ?? []).map((c) => ({
      address: c.address,
      closePrice: c.closePrice,
      closeDate: c.closeDate,
      sqft: c.sqft,
      adjusted: c.adjustedPrice,
    })),
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
