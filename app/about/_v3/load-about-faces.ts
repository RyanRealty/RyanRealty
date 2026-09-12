/**
 * /about first-viewport faces + the firm's MLS closings.
 *
 * SITE-90: each broker is a person on the fold (Matt, Rebecca, Paul). The
 * figure on a card is that broker's closings (or live listings), the same
 * ladder /team uses (`brokerRosterRecord`). Unknown is not zero. Closings
 * are the real firm record: each broker's getBrokerSales plus office-name
 * tiles, unique ListingKey, no invented rows.
 */

import {
  getBrokerBySlug,
  getBrokerageListingTiles,
  getBrokerSales,
  getBrokers,
  getListingKeysByListAgentEmail,
  getListingKeysForBrokerByLicense,
  getListingTiles,
} from '@/lib/data'
import type { BrokerSaleTile } from '@/lib/data'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { brokerRosterRecord } from '@/app/team/_v3/broker-roster-record'
import { publishFirmClosingRows, uniqueListingTiles } from '@/app/team/[slug]/_v3/sale-rows'
import { aboutFaceFromBroker, type AboutFace } from './about-faces'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'
import type { V3LedgerFigureRow } from '@/components/site/v3'

const OFFICE_NAME = 'Ryan Realty'
/** Show the firm record, not a four-row tease. Cap is the DAL page, not taste. */
const FIRM_CLOSING_LIMIT = 48

export type AboutProof = {
  faces: AboutFace[]
  closings: V3LedgerFigureRow[]
}

async function activeCitiesFor(
  row: { license_number?: string | null } | null,
  email: string | null,
): Promise<{ city: string | null }[]> {
  const keys = new Set<string>()
  const license = (row?.license_number ?? '').trim()
  if (license) {
    for (const k of await getListingKeysForBrokerByLicense(license).catch(() => [])) keys.add(k)
  }
  if (email?.trim()) {
    for (const k of await getListingKeysByListAgentEmail(email).catch(() => [])) keys.add(k)
  }
  if (keys.size === 0) return []
  const tiles = await getListingTiles({
    listingKeys: [...keys].slice(0, 200),
    status: 'active',
    limit: 50,
  }).catch(() => [])
  return tiles.map((t) => ({ city: t.city ?? null }))
}

export async function loadAboutProof(): Promise<AboutProof> {
  const brokers = await getBrokers()
  const ordered = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const [records, officeTiles] = await Promise.all([
    Promise.all(
      ordered.map(async (broker) => {
        const row = await getBrokerBySlug(broker.slug).catch(() => null)
        const sales = await getBrokerSales({
          email: broker.email,
          mlsId: (row as { mls_id?: string | null } | null)?.mls_id ?? null,
        }).catch(() => [] as BrokerSaleTile[])
        const closed = sales.filter((s) => !!s.CloseDate && s.ClosePrice != null && Number(s.ClosePrice) > 0)
        const actives = closed.length > 0 ? [] : await activeCitiesFor(row, broker.email)
        return {
          slug: broker.slug,
          record: brokerRosterRecord({ name: broker.fullName, sales, actives }),
          sales,
        }
      }),
    ),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 100 }).catch(() => [] as PriceDropTile[]),
  ])

  const recordBySlug = new Map(records.map((r) => [r.slug, r.record]))
  const saleTiles: PriceDropTile[] = uniqueListingTiles([
    ...records.flatMap((r) => r.sales),
    ...officeTiles,
  ])

  const faces = ordered
    .map((b): AboutFace | null => {
      const face = aboutFaceFromBroker(b)
      if (!face) return null
      return { ...face, record: recordBySlug.get(b.slug) ?? null }
    })
    .filter((face): face is AboutFace => face !== null)

  return {
    faces,
    closings: publishFirmClosingRows(saleTiles, FIRM_CLOSING_LIMIT),
  }
}

export async function loadAboutFaces(): Promise<AboutFace[]> {
  return (await loadAboutProof()).faces
}
