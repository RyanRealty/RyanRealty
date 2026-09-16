/**
 * The doors every featured city carries: its guide, its inventory, its open
 * houses, and for Bend the luxury page (G7, ci:westside-backlog).
 *
 * SITE-92 round 5: these are the doors of a V3DoorBoard tile, not Quiet rows.
 * Fifteen cities × two links as thirty identical icon+text+arrow rows was the
 * brief's own refuse case ("a link farm of city names with no figure"), so
 * each door now carries a `kind` the page uses to attach the count the door
 * opens onto — the open-house calendar's count for this week, the $1.5M-and-up
 * count for Bend — and the label is split into the part the tile shows
 * (`label`) and the part the tile already says (`rest`, the city's name),
 * which the board keeps in the link's text for a reader who cannot see the
 * tile and for a crawler. The set itself did not change; the hrefs are the
 * ones the gate pins.
 */
export type CityDoorKind = 'guide' | 'homes' | 'open-houses' | 'luxury'

export type CityDoor = {
  kind: CityDoorKind
  /** The door's visible label on its tile: "Homes for sale". */
  label: string
  /** The rest of the link's name, carried visually hidden: "in Bend". */
  rest?: string
  href: string
}

export function cityFeaturedLinks(slug: string, name: string): CityDoor[] {
  const items: CityDoor[] = [
    { kind: 'guide', label: `${name} guide`, href: `/cities/${slug}` },
    { kind: 'homes', label: 'Homes for sale', rest: `in ${name}`, href: `/homes-for-sale/${slug}` },
    { kind: 'open-houses', label: 'Open houses', rest: `in ${name}`, href: `/open-houses/${slug}` },
  ]
  if (slug === 'bend') {
    items.push({ kind: 'luxury', label: 'Luxury homes', rest: 'in Bend', href: '/luxury-homes-bend' })
  }
  return items
}
