/**
 * Ship class — same-category loop nodes share one rebuild.
 *
 * Fleet bots mint many findings in one surface family (place pages, search,
 * listing detail). Serving each as its own cycle runs `npm run push` (isolated
 * `next build`) + `deploy:verify` per finding and burns Build CPU. The brief
 * and sentinel serve a ship class instead: claim the set, accept locally,
 * then ONE push and ONE deploy:verify.
 *
 * Planned G-rows and Matt ADD/CHANGE stay a class of one.
 * reachability: scripts/loop-brief.ts + /admin/loop + sentinel prompt
 */

export const SHIP_CLASS_MAX = 8

export type ShipClassInput = {
  id: string
  domain: string
  title: string
  objective: string
  versionGap?: string | null
}

const PLACE_PREFIXES = [
  '/communities',
  '/cities',
  '/neighborhoods',
  '/housing-market',
  '/subdivisions',
  '/oregon',
  '/schools',
  '/parks',
  '/central-oregon',
]

/** URL the fleet-intake objective stamps after `at `. */
export function extractUrlFromObjective(objective: string): string | null {
  const abs = objective.match(/at (https?:\/\/[^\s\]]+)/i)
  if (abs?.[1]) return abs[1]
  const rel = objective.match(/at (\/[^\s\]]+)/)
  return rel?.[1] ?? null
}

export function surfaceFamilyFromUrl(url: string): string {
  let path = url.trim()
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname
  } catch {
    /* keep raw */
  }
  path = path.split('?')[0].toLowerCase()
  if (!path.startsWith('/')) path = `/${path}`
  if (PLACE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return 'place-pages'
  if (path.startsWith('/homes-for-sale/listing') || /\/homes-for-sale\/[^/]+\/.+-\d+/.test(path)) {
    return 'listing-detail'
  }
  if (path.startsWith('/homes-for-sale') || path.startsWith('/search')) return 'search'
  if (path.startsWith('/sell') || path.startsWith('/lp')) return 'seller'
  if (path.startsWith('/team')) return 'team'
  const seg = path.split('/').filter(Boolean)[0]
  return seg ?? 'site'
}

export function shipClassKey(node: ShipClassInput): string {
  if (node.title.startsWith('Fleet finding')) {
    const url = extractUrlFromObjective(node.objective)
    const family = url ? surfaceFamilyFromUrl(url) : 'unscoped'
    return `fleet:${node.domain}:${family}`
  }
  if (node.versionGap) return `gap:${node.versionGap}`
  return `solo:${node.domain}:${node.id}`
}

export function selectShipClass<T extends ShipClassInput>(
  eligible: T[],
  next: T,
  max: number = SHIP_CLASS_MAX,
): { key: string; nodes: T[]; remaining: number } {
  const key = shipClassKey(next)
  const siblings = eligible.filter((n) => shipClassKey(n) === key)
  const rest = siblings.filter((n) => n.id !== next.id)
  const nodes = [next, ...rest].slice(0, Math.max(1, max))
  return { key, nodes, remaining: Math.max(0, siblings.length - nodes.length) }
}
