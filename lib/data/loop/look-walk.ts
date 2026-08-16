/**
 * Look-walk baseline reader. Packet §1b CMA look + public-ux walk
 * stop being UNKNOWN when this file is present and complete.
 * reachability: collectCompanyScoreboardSignals, scripts/check-look-walk.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const LOOK_WALK_BASELINE_PATH = 'docs/plans/ENTERPRISE_MAP/look-walk-baseline.json'

export const LOOK_WALK_REQUIRED_ROUTES = [
  '/',
  '/homes-for-sale',
  '/cities/bend',
  '/communities/tetherow',
  '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
  '/sell',
  '/housing-market',
  '/about',
] as const

export type LookWalkRoute = {
  id: string
  route: string
  label: string
  http390: number
  http1280: number
  jobNoun: string
  knownPath: { start: string; now: string; next: string }
  quiet: { copyBudgetWords: number; foci: number }
  verdict: string
  punch: string | null
}

export type LookWalkCma = {
  status: 'ok' | 'unreadable'
  slug: string | null
  url: string | null
  pageCount: number | null
  sellerReadableOnePass: boolean
  numbersHaveUnits: boolean
  coverIsHouse: boolean
  verdict: string | null
  notes: string | null
}

export type LookWalkBaseline = {
  status: 'ok' | 'unreadable'
  recordedAt: string | null
  viewports: string[]
  source: string
  public: { routes: LookWalkRoute[] }
  cma: LookWalkCma
}

const UNREAD: LookWalkBaseline = {
  status: 'unreadable',
  recordedAt: null,
  viewports: [],
  source: LOOK_WALK_BASELINE_PATH,
  public: { routes: [] },
  cma: {
    status: 'unreadable',
    slug: null,
    url: null,
    pageCount: null,
    sellerReadableOnePass: false,
    numbersHaveUnits: false,
    coverIsHouse: false,
    verdict: null,
    notes: null,
  },
}

export function lookWalkBaselineComplete(b: LookWalkBaseline): boolean {
  if (b.status !== 'ok') return false
  if (!b.viewports.includes('390') || !b.viewports.includes('1280')) return false
  const have = new Set(b.public.routes.map((r) => r.route))
  if (!LOOK_WALK_REQUIRED_ROUTES.every((r) => have.has(r))) return false
  if (!b.public.routes.every((r) => r.http390 === 200 && r.http1280 === 200 && r.jobNoun.trim())) {
    return false
  }
  return (
    b.cma.status === 'ok' &&
    Boolean(b.cma.slug?.trim()) &&
    Boolean(b.cma.verdict?.trim()) &&
    b.cma.pageCount != null &&
    b.cma.pageCount > 0
  )
}

export function readLookWalkBaseline(root: string = process.cwd()): LookWalkBaseline {
  const path = resolve(root, LOOK_WALK_BASELINE_PATH)
  if (!existsSync(path)) return { ...UNREAD, source: LOOK_WALK_BASELINE_PATH }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<LookWalkBaseline> & {
      public?: { routes?: LookWalkRoute[] }
      cma?: Partial<LookWalkCma>
    }
    const parsed: LookWalkBaseline = {
      status: raw.status === 'ok' ? 'ok' : 'unreadable',
      recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : null,
      viewports: Array.isArray(raw.viewports) ? raw.viewports.map(String) : [],
      source: LOOK_WALK_BASELINE_PATH,
      public: { routes: Array.isArray(raw.public?.routes) ? raw.public.routes : [] },
      cma: {
        status: raw.cma?.status === 'ok' ? 'ok' : 'unreadable',
        slug: raw.cma?.slug ?? null,
        url: raw.cma?.url ?? null,
        pageCount: raw.cma?.pageCount ?? null,
        sellerReadableOnePass: Boolean(raw.cma?.sellerReadableOnePass),
        numbersHaveUnits: Boolean(raw.cma?.numbersHaveUnits),
        coverIsHouse: Boolean(raw.cma?.coverIsHouse),
        verdict: raw.cma?.verdict ?? null,
        notes: raw.cma?.notes ?? null,
      },
    }
    if (!lookWalkBaselineComplete(parsed)) return { ...parsed, status: 'unreadable' }
    return parsed
  } catch {
    return { ...UNREAD, source: LOOK_WALK_BASELINE_PATH }
  }
}
