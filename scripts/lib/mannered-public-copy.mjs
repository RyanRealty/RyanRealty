/**
 * mannered-public-copy.mjs — Tip Ready refuse for visitor-facing copy that
 * lectures the reader about the UI (Matt 2026-09-14).
 *
 * Wired into taste-receipt `--ship` / tasteDoneProblems. Not a new rubric,
 * not a Cos-eye path. Same Looking refuse class as competitiveBrief:
 * inventing past what the heading + control already say.
 *
 * Six tells:
 *   1. Meta-explainer / "this map is the full record" lecture
 *   2. Action-narrating control labels ("CALL 541…" on a Call door)
 *   3. Homepage Researchy brief dumped as visitor copy (homeBriefText)
 *   4. Place-list intro that narrates the map / filters ("the same homes the map above")
 *   5. Mannered self-explaining intros ("Three licensed…", "the one you call…",
 *      "Where those closings were") — over-explain / obvious blurb (Matt 2026-09-15)
 *   6. Inventory-count lectures on rails / carousels / place folds
 *      ("3,271 homes for sale across Central Oregon…") — cut, do not replace (Matt 2026-09-15)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const MANNERED_COPY_REFUSE =
  'mannered public copy: overtly stating the obvious / meta-explainer / self-explaining intro ("Three licensed…", "the one you call…", "Where those closings were" class). Looking refuse. Leave the node in_progress.'

export const ACTION_BILLBOARD_REFUSE =
  'mannered public copy: action-narrating control ("CALL 541…" billboard). Quiet Call | Text | Email | Schedule. Leave the node in_progress.'

export const HOME_BRIEF_LEAK_REFUSE =
  'mannered public copy: HOME_COMPETITIVE_BRIEF / homeBriefText rendered as visitor copy. Demonstrate the beats (inventory, morph search, rails). Leave the node in_progress.'

export const INVENTORY_LECTURE_REFUSE =
  'mannered public copy: inventory-count lecture ("N homes for sale across…"). Cut — do not replace with another explain. Leave the node in_progress.'

/** "3,271 homes for sale across Central Oregon…" under Homes in Bend / place folds. */
export const INVENTORY_LECTURE_RES = Object.freeze([
  /\d[\d,]*\+?\s*homes for sale across/i,
  /homes for sale across Central Oregon/i,
  /homes for sale across these (cities|districts|communities)/i,
  /homes for sale across .+ communities/i,
  /homes for sale across .+ subdivisions/i,
])

/** Visitor-facing lectures about how the map / feed / filter works. */
export const MANNERED_EXPLAINER_RES = Object.freeze([
  /this map is the full record/i,
  /trailing window of that same feed/i,
  /how this map works/i,
  /12-month counts on the faces/i,
  /recorded on the MLS that carries a coordinate/i,
  /hover a mark for/i,
  /the claim updates with your filter/i,
  /the same homes the map above/i,
  /the map above marks/i,
  /as the map above marks/i,
  /the map above draws from/i,
  /a plat drawn on the map above/i,
  /market section further down/i,
  /counted on the market section/i,
  /with price, beds and property type on the filters/i,
  /* /team mannered hero intro (Matt 2026-09-15 Writing Bot) */
  /Three licensed Oregon brokers/i,
  /the one you call is the one who works your deal/i,
  /works your deal,? start to close/i,
  /each of them shows what they have actually closed/i,
  /Where those closings were/i,
  /Where those sales were/i,
  /same broker with you from the first call through closing/i,
])

/** Homepage spec dumped as public copy (Matt 2026-09-15). Not the TS brief object. */
export const HOME_BRIEF_LEAK_RES = Object.freeze([
  /homeBriefText\s*\(/,
  /home-hero-search__brief/,
  /home-rails__brief/,
  /home-browse-places__brief/,
  /home-featured-community__brief/,
  /Search field that morphs into results/i,
  /The homepage opens with live inventory in the first viewport/i,
  /Buy \/ Sell as tabs with a sliding indicator/i,
  /House cards on the rail: price, address, beds\/baths\/sqft/i,
  /Search hero carries a live market or inventory signal/i,
  /Featured community cards carry sourced pulse figures/i,
  /Browse places with live town counts, not identical empty chips/i,
])

/** ALL-CAPS or title-case verb plus a phone number in one visible label. */
export const ACTION_BILLBOARD_RE =
  /\b(?:CALL|TEXT|EMAIL|Call|Text|Email)\s+[+(]?\d[\d.()\s-]{5,}\d/

const TEAM_COPY_FILES = Object.freeze(['app/team/page.tsx', 'app/team/_v3/broker-roster-record.ts', 'app/about/_v3/AboutFaces.tsx'])

const HOME_COPY_FILES = Object.freeze([
  'app/page.tsx',
  'app/_v3/HomeHeroSearch.client.tsx',
  'app/_v3/HomeHomesRails.tsx',
  'app/_v3/HomeListingRail.client.tsx',
  'app/_v3/HomeBrowsePlaces.tsx',
  'app/_v3/HomeFeaturedCommunity.client.tsx',
])

const EXTRA_PUBLIC_COPY = Object.freeze({
  'listing-detail': [
    'app/listing/[listingKey]/page.tsx',
    'components/site/listing-detail/ListingFold.tsx',
    'components/site/listing-detail/ListingHero.tsx',
  ],
})

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Strip comments so a code note cannot trip a visitor-copy refuse. */
export function stripSourceComments(source) {
  return String(source ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Quoted strings and JSX attribute values — the copy a reader can see.
 * Import paths and bare module ids are dropped.
 */
export function publicCopyHaystack(source) {
  const text = stripSourceComments(source)
  const out = []
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let m
  while ((m = re.exec(text))) {
    const s = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (!s.trim()) continue
    if (/^(@\/|\.{1,2}\/|https?:\/\/|[A-Za-z0-9_-]+)$/.test(s.trim())) continue
    if (s.includes('/') && !/\s/.test(s) && s.length < 80) continue
    out.push(s)
  }
  return out.join('\n')
}

function editorialReachBody(source) {
  const text = stripSourceComments(source)
  const m = text.match(/function editorialReach\b[\s\S]*?(?=\nfunction |\nexport |\nconst [A-Z]|$)/)
  return m ? m[0] : ''
}

/** Call chip on /team editorial that also prints the number is a billboard. */
export function editorialCallBillboard(source) {
  const body = editorialReachBody(source)
  if (!body) return false
  return (
    /reach-label[\s\S]{0,240}Call[\s\S]{0,240}phoneDisplay/.test(body) ||
    /Call[\s\S]{0,120}reach-num[\s\S]{0,80}phoneDisplay/.test(body)
  )
}

export function publicCopyFilesFor({ route, kit } = {}) {
  const files = []
  if (typeof route === 'string' && route.startsWith('app/') && !route.includes('..')) {
    files.push(route)
  }
  if (kit === 'team') {
    for (const f of TEAM_COPY_FILES) {
      if (!files.includes(f)) files.push(f)
    }
  }
  if (kit === 'homepage-v6' || route === 'app/page.tsx') {
    for (const f of HOME_COPY_FILES) {
      if (!files.includes(f)) files.push(f)
    }
  }
  const extras = EXTRA_PUBLIC_COPY[kit] ?? []
  for (const f of extras) {
    if (!files.includes(f)) files.push(f)
  }
  return files
}

export function readPublicCopySource({ route, kit, root = process.cwd(), sourceText } = {}) {
  if (sourceText != null) return String(sourceText)
  const parts = []
  for (const rel of publicCopyFilesFor({ route, kit })) {
    const abs = join(root, rel)
    if (existsSync(abs)) parts.push(readFileSync(abs, 'utf8'))
  }
  return parts.join('\n')
}

/**
 * Empty array = pass. `sourceText` omitted / empty = no opinion (unit tests
 * that are not about copy stay green). A fixture string is enough.
 */
export function manneredPublicCopyProblems(sourceText) {
  if (sourceText == null) return []
  const raw = String(sourceText)
  if (!raw.trim()) return []
  const stripped = stripSourceComments(raw)
  const hay = publicCopyHaystack(raw)
  const scan = `${hay}\n${stripped}`
  const p = []
  if (MANNERED_EXPLAINER_RES.some((re) => re.test(scan))) {
    p.push(MANNERED_COPY_REFUSE)
  }
  if (ACTION_BILLBOARD_RE.test(scan) || editorialCallBillboard(raw)) {
    p.push(ACTION_BILLBOARD_REFUSE)
  }
  if (HOME_BRIEF_LEAK_RES.some((re) => re.test(scan))) {
    p.push(HOME_BRIEF_LEAK_REFUSE)
  }
  if (INVENTORY_LECTURE_RES.some((re) => re.test(scan))) {
    p.push(INVENTORY_LECTURE_REFUSE)
  }
  return p
}

export function resolveCopySourceForTaste(opts = {}) {
  if (!isPlainObject(opts)) return undefined
  if (opts.sourceText != null) return String(opts.sourceText)
  const loaded = readPublicCopySource(opts)
  return loaded.trim() ? loaded : undefined
}
