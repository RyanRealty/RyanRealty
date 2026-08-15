/**
 * Arrival classification for the homepage island.
 *
 * Google / ad / email / text / shared listing: let them go. Infer intent
 * from the URL. Buy · Sell · Look only on typed-in blank `/` with no
 * visitor and no person. Welcome back names the house or search they left.
 */

export type DeclaredIntent = 'buyer' | 'seller' | 'look'
export type ArrivalKind = 'inbound' | 'returner' | 'unknown_direct'
export type ArrivalSource = 'inbound' | 'return' | 'unknown_direct' | 'tap'

export type LastThing = {
  kind: 'house' | 'search'
  label: string
  href: string
}

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export type ClassifyArrivalInput = {
  referrer: string
  href: string
  lastThing?: LastThing | null
  hasVisitor?: boolean
  hasPerson?: boolean
  declaredIntent?: DeclaredIntent | null
}

export type ArrivalClassification = {
  kind: ArrivalKind
  showQuiz: boolean
  showWelcome: boolean
  source: ArrivalSource
  intent: DeclaredIntent
  thing: LastThing | null
}

export const RR_LAST_THING_KEY = 'rr_last_thing'
export const RR_INTENT_KEY = 'rr_intent'
export const RR_INTENT_DECLARED_KEY = 'rr_intent_declared'
export const RR_WELCOME_BACK_KEY = 'rr_welcome_back'

function sessionStore(): StorageLike | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function pathnameOf(href: string): string {
  const url = safeUrl(href)
  if (url) return url.pathname
  const path = href.split('?')[0] ?? href
  return path || '/'
}

function isBlankHome(pathname: string): boolean {
  return pathname === '/' || pathname === ''
}

export function isListingPath(pathname: string): boolean {
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '')
  const segs = p.split('/').filter(Boolean)
  if (segs[0] === 'listing' && segs[1] && segs[1] !== 'by-address' && segs[1] !== 'by-key') {
    return true
  }
  if (segs[0] === 'homes-for-sale' && segs.length >= 3) {
    return /\d{6,}$/.test(segs[segs.length - 1] ?? '')
  }
  return false
}

function hasInboundQuery(href: string): boolean {
  const url = safeUrl(href)
  if (!url) return false
  const q = url.searchParams
  if (q.has('gclid') || q.has('fbclid') || q.has('msclkid') || q.has('ttclid')) return true
  if ([...q.keys()].some((key) => key.toLowerCase().startsWith('utm_'))) return true
  if (q.has('agent') || q.has('_pid') || q.has('_fuid')) return true
  const next = q.get('next')
  if (next && isListingPath(next)) return true
  return false
}

function isInboundReferrer(referrer: string): boolean {
  const url = safeUrl(referrer)
  if (!url) return false
  const host = url.hostname.toLowerCase()
  return (
    /(^|\.)google\./.test(host) ||
    /(^|\.)bing\./.test(host) ||
    /(^|\.)duckduckgo\./.test(host) ||
    /(^|\.)facebook\./.test(host) ||
    host === 'fb.com' ||
    /(^|\.)instagram\./.test(host) ||
    /(^|\.)l\.instagram\./.test(host) ||
    /^mail\./.test(host) ||
    /(^|\.)outlook\./.test(host) ||
    /(^|\.)yahoo\./.test(host)
  )
}

function isSameOriginReferrer(referrer: string, href: string): boolean {
  const ref = safeUrl(referrer)
  const page = safeUrl(href)
  if (!ref || !page) return false
  return ref.origin === page.origin
}

export function inferIntentFromPath(pathname: string): DeclaredIntent {
  const p = (pathname || '/').toLowerCase()
  if (/^\/(sell|home-valuation|lp\/seller|lp\/expired|lp\/fsbo)(\/|$)/.test(p)) return 'seller'
  if (isListingPath(p) || /^\/(search|homes-for-sale|listing|our-homes)(\/|$)/.test(p)) return 'buyer'
  if (
    /^\/(housing-market|about|team|reviews|videos|central-oregon|area-guides|blog|communities|cities)(\/|$)/.test(
      p,
    )
  ) {
    return 'look'
  }
  if (isBlankHome(p)) return 'buyer'
  return 'look'
}

export function classifyArrival(input: ClassifyArrivalInput): ArrivalClassification {
  const pathname = pathnameOf(input.href)
  const intent = inferIntentFromPath(pathname)
  const thing = input.lastThing ?? null
  const inbound = hasInboundQuery(input.href) || isInboundReferrer(input.referrer)

  if (inbound) {
    return {
      kind: 'inbound',
      showQuiz: false,
      showWelcome: false,
      source: 'inbound',
      intent,
      thing: null,
    }
  }

  if (thing) {
    return {
      kind: 'returner',
      showQuiz: false,
      showWelcome: true,
      source: 'return',
      intent,
      thing,
    }
  }

  if (input.hasVisitor || input.hasPerson || input.declaredIntent) {
    return {
      kind: 'returner',
      showQuiz: false,
      showWelcome: false,
      source: 'return',
      intent: input.declaredIntent ?? intent,
      thing: null,
    }
  }

  const referrer = input.referrer.trim()
  const typedOrBlank =
    referrer.length === 0 || isSameOriginReferrer(referrer, input.href)

  if (typedOrBlank && isBlankHome(pathname)) {
    return {
      kind: 'unknown_direct',
      showQuiz: true,
      showWelcome: false,
      source: 'unknown_direct',
      intent,
      thing: null,
    }
  }

  return {
    kind: 'inbound',
    showQuiz: false,
    showWelcome: false,
    source: 'inbound',
    intent,
    thing: null,
  }
}

export function welcomeThing(thing: LastThing): { line: string; href: string; label: string } {
  const label = thing.label.trim()
  return {
    line: `Welcome back. ${label}.`,
    href: thing.href,
    label,
  }
}

export function persistIntent(intent: DeclaredIntent, storage?: StorageLike | null): void {
  const store = storage ?? sessionStore()
  if (!store) return
  store.setItem(RR_INTENT_KEY, intent)
}

export function readPersistedIntent(storage?: StorageLike | null): DeclaredIntent | null {
  const store = storage ?? sessionStore()
  const value = store?.getItem(RR_INTENT_KEY)
  if (value === 'buyer' || value === 'seller' || value === 'look') return value
  return null
}

export function lastThingFromHouse(input: { path: string; street?: string | null }): LastThing {
  const street = input.street?.trim()
  return {
    kind: 'house',
    label: street || streetLabelFromListingPath(input.path) || 'that house',
    href: input.path,
  }
}

export function lastThingFromSearch(input: { href: string; query?: string | null }): LastThing {
  const query = input.query?.trim()
  return {
    kind: 'search',
    label: query || 'your search',
    href: input.href,
  }
}

export function streetLabelFromListingPath(pathname: string): string | null {
  const segs = pathname.split('/').filter(Boolean)
  const last = segs[segs.length - 1] ?? ''
  const match = last.match(/^(.+)-(\d{6,})$/)
  if (!match) return null
  const words = match[1].split('-').filter(Boolean)
  if (words.length === 0) return null
  return words
    .map((word) => (/^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

export function writeLastThing(thing: LastThing, storage?: StorageLike | null): void {
  const store = storage ?? sessionStore()
  if (!store) return
  store.setItem(RR_LAST_THING_KEY, JSON.stringify(thing))
}

export function readLastThing(storage?: StorageLike | null): LastThing | null {
  const store = storage ?? sessionStore()
  const raw = store?.getItem(RR_LAST_THING_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<LastThing>
    if (parsed.kind !== 'house' && parsed.kind !== 'search') return null
    if (typeof parsed.label !== 'string' || parsed.label.trim().length === 0) return null
    if (typeof parsed.href !== 'string' || parsed.href.trim().length === 0) return null
    return { kind: parsed.kind, label: parsed.label.trim(), href: parsed.href.trim() }
  } catch {
    return null
  }
}

export function hasSessionFlag(key: string, storage?: StorageLike | null): boolean {
  const store = storage ?? sessionStore()
  return store?.getItem(key) === '1'
}

export function setSessionFlag(key: string, storage?: StorageLike | null): void {
  const store = storage ?? sessionStore()
  store?.setItem(key, '1')
}
