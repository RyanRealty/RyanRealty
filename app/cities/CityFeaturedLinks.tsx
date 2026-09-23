import type { V3QuietItem } from '@/components/site/v3'
import { bendLuxuryHomesDoor } from '@/lib/site/bend-luxury-homes'

/**
 * The doors every featured city carries: its guide, its inventory, its open
 * houses, and for Bend the luxury winner /homes-for-sale/bend/luxury (G7,
 * ci:westside-backlog; SITE-185 one winner for "Bend luxury homes for sale").
 *
 * It returns Quiet items rather than markup. The cities index is a Ledger of
 * cities and a Ledger row is ONE door by definition (PUBLIC_UI.md section 3),
 * so the second, third and fourth door per city belong in the block that
 * carries this node's outbound edges. The set itself did not change.
 */
export function cityFeaturedLinks(slug: string, name: string): V3QuietItem[] {
  const items: V3QuietItem[] = [
    { label: `${name} guide`, href: `/cities/${slug}` },
    { label: `Homes for sale in ${name}`, href: `/homes-for-sale/${slug}` },
    { label: `Open houses in ${name}`, href: `/open-houses/${slug}` },
  ]
  if (slug === 'bend') {
    items.push(bendLuxuryHomesDoor())
  }
  return items
}
