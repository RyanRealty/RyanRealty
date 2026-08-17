/**
 * Ship class — same-category loop nodes share one rebuild.
 *
 * Fleet bots mint many findings in one surface family (place pages, search,
 * listing detail). Serving each as its own cycle runs `npm run push` (isolated
 * `next build`) + `deploy:verify` per finding and burns Build CPU. The brief
 * and sentinel serve a ship class instead: claim the set, accept locally,
 * then ONE push and ONE deploy:verify.
 *
 * When the eligible OPEN head is the FLEET-PUNCH inbox, the class is a
 * virtual slice of punch *lines* (one surface family, p0 then major then
 * minor, capped). The parent stays the one node. Do not mint children.
 *
 * Planned G-rows and Matt ADD/CHANGE stay a class of one.
 * reachability: scripts/loop-brief.ts + /admin/loop + sentinel prompt
 */

import { COMPANY_BLAST_RADIUS } from './domains'
import {
  FLEET_PUNCH_GAP,
  isFleetPunchListNode,
  openPunchLines,
  type PunchLine,
} from './fleet-intake-core'

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
  // Punch inbox is not a sibling of leftover Fleet finding [ singles.
  // The served slice key (fleet:domain:family) comes from selectPunchSlice.
  if (isFleetPunchListNode(node)) return `gap:${FLEET_PUNCH_GAP}`
  if (node.title.startsWith('Fleet finding')) {
    const url = extractUrlFromObjective(node.objective)
    const family = url ? surfaceFamilyFromUrl(url) : 'unscoped'
    return `fleet:${node.domain}:${family}`
  }
  if (node.versionGap) return `gap:${node.versionGap}`
  return `solo:${node.domain}:${node.id}`
}

const SEV_RANK: Record<PunchLine['severity'], number> = { p0: 0, major: 1, minor: 2 }

export type PunchLineWithFamily = PunchLine & { family: string }

export type PunchSlice = {
  key: string
  family: string
  domain: string
  served: PunchLineWithFamily[]
  leftoverInFamily: number
  leftoverOtherFamilies: number
  openTotal: number
}

function familyPriority(lines: PunchLineWithFamily[]): number {
  return Math.min(...lines.map((l) => SEV_RANK[l.severity]))
}

export function selectPunchSlice(
  objective: string,
  domain: string,
  max: number = SHIP_CLASS_MAX,
): PunchSlice {
  const open = openPunchLines(objective).map((line) => ({
    ...line,
    family: line.url ? surfaceFamilyFromUrl(line.url) : 'unscoped',
  }))
  const cap = Math.max(1, max)
  if (!open.length) {
    return {
      key: `fleet:${domain}:punch`,
      family: 'punch',
      domain,
      served: [],
      leftoverInFamily: 0,
      leftoverOtherFamilies: 0,
      openTotal: 0,
    }
  }

  const byFamily = new Map<string, PunchLineWithFamily[]>()
  for (const line of open) {
    const list = byFamily.get(line.family) ?? []
    list.push(line)
    byFamily.set(line.family, list)
  }

  const families = [...byFamily.entries()].sort((a, b) => {
    const pri = familyPriority(a[1]) - familyPriority(b[1])
    if (pri !== 0) return pri
    return open.indexOf(a[1][0]) - open.indexOf(b[1][0])
  })
  const [family, familyLines] = families[0]
  const ranked = [...familyLines].sort((a, b) => {
    const sev = SEV_RANK[a.severity] - SEV_RANK[b.severity]
    if (sev !== 0) return sev
    return familyLines.indexOf(a) - familyLines.indexOf(b)
  })
  const served = ranked.slice(0, cap)
  return {
    key: `fleet:${domain}:${family}`,
    family,
    domain,
    served,
    leftoverInFamily: Math.max(0, ranked.length - served.length),
    leftoverOtherFamilies: open.length - familyLines.length,
    openTotal: open.length,
  }
}

export type ShipClass<T extends ShipClassInput> = {
  key: string
  nodes: T[]
  remaining: number
  punch: PunchSlice | null
}

export function selectShipClass<T extends ShipClassInput>(
  eligible: T[],
  next: T,
  max: number = SHIP_CLASS_MAX,
): ShipClass<T> {
  if (isFleetPunchListNode(next)) {
    const punch = selectPunchSlice(next.objective, next.domain, max)
    return { key: punch.key, nodes: [next], remaining: punch.leftoverInFamily, punch }
  }
  const key = shipClassKey(next)
  const siblings = eligible.filter((n) => shipClassKey(n) === key)
  const rest = siblings.filter((n) => n.id !== next.id)
  const nodes = [next, ...rest].slice(0, Math.max(1, max))
  return { key, nodes, remaining: Math.max(0, siblings.length - nodes.length), punch: null }
}

export function formatPunchSliceBrief(input: {
  punch: PunchSlice
  nodeId: string
  reads: readonly string[]
}): string[] {
  const { punch, nodeId, reads } = input
  const leftover = punch.leftoverInFamily + punch.leftoverOtherFamilies
  const lines: string[] = []
  lines.push(
    `class: ${punch.key} · punch-list slice ${punch.served.length} line(s) of ${punch.openTotal} open · family ${punch.family}${punch.leftoverInFamily ? ` · ${punch.leftoverInFamily} leftover in this family stay on the parent` : ''}${punch.leftoverOtherFamilies ? ` · ${punch.leftoverOtherFamilies} other-family line(s) stay on the parent` : ''}`,
  )
  lines.push('PARENT is the inbox. Claim only this node. Do not mint child graph nodes.')
  lines.push(`claim them: claimShipClass([${nodeId}], owner)  (lib/data/loop/work-graph.ts)`)
  lines.push(
    'Claim the parent so sentinel stands down. Intake may still append new punch lines while this slice is in flight.',
  )
  lines.push('DO NOT run npm run push or deploy:verify until every served line is locally accepted or rejected.')
  lines.push('Then ONE push, ONE deploy:verify. Mark served lines fixed/rejected on the parent (resolvePunchLines).')
  lines.push(
    leftover
      ? `Do NOT completeWorkNode on FLEET-PUNCH — ${leftover} open line(s) remain. After the slice: resolvePunchLines, then releaseWorkNode so leftover lines stay the inbox.`
      : 'Completing FLEET-PUNCH is valid only when every punch line is fixed or rejected (zero open lines).',
  )
  lines.push('load first (this animal\'s discipline — read before working):')
  for (const r of reads) lines.push(`  - ${r}`)
  lines.push('  - REQUIREMENTS.md rows covering this class (grep the gap ref) + the canon preflight for whatever the change touches')
  if (punch.domain === 'public-ux') {
    lines.push('blast-radius (name every plane this class touches before you start):')
    for (const plane of COMPANY_BLAST_RADIUS) lines.push(`  - ${plane}`)
  }
  lines.push('')
  if (!punch.served.length) {
    lines.push('No open punch lines. completeWorkNode is allowed with evidence that the inbox is empty.')
    return lines
  }
  for (const [i, line] of punch.served.entries()) {
    lines.push(`--- PUNCH ${i + 1}/${punch.served.length} · ${punch.key} ---`)
    lines.push(`severity:     ${line.severity}`)
    lines.push(`url:          ${line.url}`)
    lines.push(`observed:     ${line.observed}`)
    lines.push(`fingerprint:  fleet:${line.fingerprint}`)
    lines.push(`family:       ${line.family}`)
    lines.push(
      'FIRST STEP: reproduce this yourself at the URL (390 and 1280). If it does not reproduce, reject this line with evidence — do not invent a fix.',
    )
    lines.push(
      'accept:       Class-fix (or reject) this line at 390+1280 with screenshots. Do not mark FLEET-PUNCH done for this slice alone.',
    )
    lines.push('')
  }
  return lines
}
