/**
 * /about first-viewport faces + each broker's MLS record.
 *
 * SITE-90: the fold is a house of faces, not three identical directory cards.
 * The figure on a card is this broker's closings (or live listings), the same
 * ladder /team uses (`brokerRosterRecord`). Unknown is not zero.
 */

import {
  getBrokerBySlug,
  getBrokerSales,
  getBrokers,
  getListingKeysByListAgentEmail,
  getListingKeysForBrokerByLicense,
  getListingTiles,
} from '@/lib/data'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { brokerRosterRecord } from '@/app/team/_v3/broker-roster-record'
import { aboutFaceFromBroker, type AboutFace } from './about-faces'

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

export async function loadAboutFaces(): Promise<AboutFace[]> {
  const brokers = await getBrokers()
  const ordered = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const records = await Promise.all(
    ordered.map(async (broker) => {
      const row = await getBrokerBySlug(broker.slug).catch(() => null)
      const sales = await getBrokerSales({
        email: broker.email,
        mlsId: (row as { mls_id?: string | null } | null)?.mls_id ?? null,
      }).catch(() => [])
      const closed = sales.filter((s) => !!s.CloseDate && s.ClosePrice != null && Number(s.ClosePrice) > 0)
      const actives = closed.length > 0 ? [] : await activeCitiesFor(row, broker.email)
      return {
        slug: broker.slug,
        record: brokerRosterRecord({ name: broker.fullName, sales, actives }),
      }
    }),
  )
  const recordBySlug = new Map(records.map((r) => [r.slug, r.record]))

  return ordered
    .map((b): AboutFace | null => {
      const face = aboutFaceFromBroker(b)
      if (!face) return null
      return { ...face, record: recordBySlug.get(b.slug) ?? null }
    })
    .filter((face): face is AboutFace => face !== null)
}
