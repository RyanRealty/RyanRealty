/**
 * One UTM convention for every outbound ryan-realty.com link (Analytics fix 8).
 *
 * buildTrackedUrl(url, { source, medium, campaign, content?, term?, test?, extraParams? })
 *   - lowercases every UTM value
 *   - validates against the vocab below (throws in test/dev; in production
 *     falls back to a known-good value and console.warn — a send/render must
 *     never fail because a UTM was off-vocab)
 *   - replaces every existing utm_* on the URL (exactly one set; never appends)
 *   - keeps path, hash, and every non-UTM query param
 *
 * Document identity for CMA open attribution is NOT a UTM. Carry it as
 * `rr_doc=<cmas.slug>` (CMA_DOC_PARAM). Never put a street address, a person
 * name, or a per-property slug in any utm_* value.
 *
 * Test / preview sends set `test: true`, which rewrites campaign to `test-<campaign>`.
 */

export const CMA_DOC_PARAM = 'rr_doc' as const

export const UTM_SOURCES = [
  'crm',
  'cma',
  'gbp',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'newsletter',
  'zillow',
  'realtor',
] as const

export const UTM_MEDIUMS = [
  'email',
  'sms',
  'organic',
  'social',
  'paid_social',
  'cpc',
  'document',
  'referral',
  'qr',
] as const

/**
 * Stable program slugs. Never a street address, never a person, never a
 * per-property or per-send id.
 *
 * Beyond the B4 table: listing-alerts, gbp-profile, newsletter, social-post,
 * crm-outbound (generic CRM fill / test-send default).
 */
export const UTM_CAMPAIGNS = [
  'cma-letter',
  'expired-outreach',
  'fsbo-outreach',
  'open-house-weekly',
  'listing-launch',
  'listing-alerts',
  'gbp-profile',
  'newsletter',
  'social-post',
  'crm-outbound',
] as const

export const UTM_CONTENT_EXACT = ['v2', 'cta-top', 'why-list'] as const

export type UtmSource = (typeof UTM_SOURCES)[number] | `referral-${string}`
export type UtmMedium = (typeof UTM_MEDIUMS)[number]
export type UtmCampaign = (typeof UTM_CAMPAIGNS)[number] | `market-report-${string}` | `test-${string}`
export type UtmContent = (typeof UTM_CONTENT_EXACT)[number] | `listing-${string}` | `agent-${string}` | string

export type UtmFields = {
  source: string
  medium: string
  campaign?: string
  content?: string
  term?: string
}

export type BuildTrackedUrlOpts = UtmFields & {
  /** Rewrite campaign to `test-<campaign>` for preview / self-test sends. */
  test?: boolean
  /**
   * First-party, non-UTM query params to set (e.g. `{ rr_doc: cmaSlug }`).
   * Not validated as UTMs — CMA slugs may contain an address; they must not
   * reach GA4 (strip list in app/api/visitors/track/strip-identity.ts).
   */
  extraParams?: Record<string, string>
}

export type UtmValidationOk = { ok: true; value: NormalizedUtm }
export type UtmValidationErr = { ok: false; error: string; field: keyof UtmFields | 'value' }
export type UtmValidationResult = UtmValidationOk | UtmValidationErr

export type NormalizedUtm = {
  source: UtmSource
  medium: UtmMedium
  campaign?: UtmCampaign
  content?: string
  term?: string
}

const SOURCE_SET = new Set<string>(UTM_SOURCES)
const MEDIUM_SET = new Set<string>(UTM_MEDIUMS)
const CAMPAIGN_SET = new Set<string>(UTM_CAMPAIGNS)
const CONTENT_EXACT_SET = new Set<string>(UTM_CONTENT_EXACT)
const PAID_MEDIUMS = new Set<string>(['cpc', 'paid_social'])

const SOURCE_ALIASES: Record<string, string> = {
  'email-click': 'crm',
  'ryan-realty': 'crm',
}

const MEDIUM_ALIASES: Record<string, string> = {
  doc: 'document',
  'personal-link': 'social',
  organic_post: 'social',
  text: 'sms',
  qrcode: 'qr',
}

const CAMPAIGN_ALIASES: Record<string, string> = {
  profile: 'gbp-profile',
  expired: 'expired-outreach',
  fsbo: 'fsbo-outreach',
}

/** Street suffix / directional tokens used to detect addresses in UTM values. */
const STREET_TOKEN =
  '(?:st|ave|av|ne|nw|se|sw|n|s|e|w|rd|dr|ln|way|ct|pl|blvd|hwy|loop|ter|cir|trl|street|avenue|road|drive|lane|court|place|boulevard|highway|terrace|circle|trail)'

/**
 * Words that appear in allowed two-token program slugs so the name heuristic
 * does not reject `cta-top`, `cma-letter`, etc.
 */
/** Obvious given names so `john-smith` rejects and `bend-sellers` does not. */
const GIVEN_NAMES = new Set([
  'john',
  'jane',
  'mary',
  'james',
  'robert',
  'michael',
  'david',
  'sarah',
  'jennifer',
  'william',
  'nate',
  'nathan',
  'matt',
  'matthew',
  'paul',
  'rebecca',
  'alex',
  'jordan',
  'emily',
  'daniel',
  'chris',
  'christopher',
  'jessica',
  'ashley',
  'andrew',
  'joshua',
  'amanda',
  'stephanie',
  'joseph',
  'thomas',
])

const PROGRAM_WORDS = new Set([
  'cma',
  'letter',
  'outreach',
  'report',
  'weekly',
  'launch',
  'alerts',
  'profile',
  'email',
  'social',
  'organic',
  'listing',
  'house',
  'open',
  'market',
  'expired',
  'fsbo',
  'gbp',
  'crm',
  'newsletter',
  'document',
  'paid',
  'click',
  'outbound',
  'post',
  'cta',
  'top',
  'why',
  'list',
  'agent',
  'test',
  'referral',
])

const REFERRAL_SOURCE_RE = /^referral-[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/
const MARKET_REPORT_RE = /^market-report-\d{4}-(0[1-9]|1[0-2])$/
const LISTING_CONTENT_RE = /^listing-[a-z0-9]+$/
const AGENT_CONTENT_RE = /^agent-[a-z][a-z0-9-]{0,60}$/
const CONTENT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CMA_SLUG_RE = /^cma-[a-z0-9-]{1,116}$/

export function isUtmSource(value: string): value is UtmSource {
  return SOURCE_SET.has(value) || REFERRAL_SOURCE_RE.test(value)
}

export function isUtmMedium(value: string): value is UtmMedium {
  return MEDIUM_SET.has(value)
}

export function isUtmCampaign(value: string): value is UtmCampaign {
  if (CAMPAIGN_SET.has(value) || MARKET_REPORT_RE.test(value)) return true
  if (value.startsWith('test-')) {
    const inner = value.slice(5)
    return inner.length > 0 && isUtmCampaign(inner)
  }
  return false
}

export function utcYearMonth(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function marketReportCampaign(periodYm?: string | null, now: Date = new Date()): string {
  const raw = (periodYm ?? '').trim()
  const ym = /^\d{4}-(0[1-9]|1[0-2])/.test(raw) ? raw.slice(0, 7) : utcYearMonth(now)
  return `market-report-${ym}`
}

export function prospectCampaign(kind: 'expired' | 'fsbo'): 'expired-outreach' | 'fsbo-outreach' {
  return kind === 'fsbo' ? 'fsbo-outreach' : 'expired-outreach'
}

/** A CMA *document* slug (the identity that used to live in utm_campaign). */
export function isCmaDocumentSlug(value: string | null | undefined): boolean {
  const slug = (value ?? '').trim().toLowerCase()
  if (!slug.startsWith('cma-')) return false
  if (CAMPAIGN_SET.has(slug)) return false
  if (slug.startsWith('test-')) return false
  return CMA_SLUG_RE.test(slug) && /^[a-z0-9-]{4,120}$/.test(slug)
}

/**
 * Address heuristic (any UTM field):
 *   - `--v2`-style per-property suffix
 *   - a 5-digit zip-like run as its own hyphen token
 *   - digits followed by a street suffix / directional (st, ave, ne, nw, rd, …)
 *
 * Name heuristic (any UTM field not already in vocab):
 *   - exactly two alphabetic tokens of 3–12 letters, neither a program word
 *     (`john-smith` rejects; `cma-letter` and `cta-top` do not)
 */
export function utmValueLooksLikeAddress(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (/--v\d+/.test(v)) return true
  if (/(?:^|-)(\d{5})(?:-|$)/.test(v)) return true
  const street = new RegExp(`(?:^|-)\\d+[a-z0-9]*-(?:[a-z0-9]+-)*${STREET_TOKEN}(?:-|$)`)
  if (street.test(v)) return true
  if (new RegExp(`(?:^|-)\\d+-${STREET_TOKEN}(?:-|$)`).test(v)) return true
  if (/(?:^|-)\d+-(?:ne|nw|se|sw)(?:-|$)/.test(v)) return true
  return false
}

export function utmValueLooksLikePersonName(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (isUtmSource(v) || isUtmMedium(v) || isUtmCampaign(v) || CONTENT_EXACT_SET.has(v)) return false
  const parts = v.split('-').filter(Boolean)
  if (parts.length !== 2) return false
  const [a, b] = parts
  if (!a || !b) return false
  if (!/^[a-z]{3,12}$/.test(a) || !/^[a-z]{3,12}$/.test(b)) return false
  if (PROGRAM_WORDS.has(a) || PROGRAM_WORDS.has(b)) return false
  return GIVEN_NAMES.has(a)
}

function forbiddenReason(value: string): string | null {
  if (utmValueLooksLikeAddress(value)) {
    return `UTM value looks like a street address or per-property slug: "${value}"`
  }
  if (utmValueLooksLikePersonName(value)) {
    return `UTM value looks like a person name: "${value}"`
  }
  return null
}

function lower(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

function remapSource(raw: string): string {
  const v = lower(raw)
  return SOURCE_ALIASES[v] ?? v
}

function remapMedium(raw: string): string {
  const v = lower(raw)
  return MEDIUM_ALIASES[v] ?? v
}

/** Legacy pairs from the previous convention doc (source=email / medium=newsletter). */
function remapPair(sourceRaw: string, mediumRaw: string): { source: string; medium: string } {
  const s0 = lower(sourceRaw)
  const m0 = lower(mediumRaw)
  if (s0 === 'email' && m0 === 'newsletter') return { source: 'newsletter', medium: 'email' }
  if (s0 === 'email-click') return { source: 'crm', medium: m0 ? remapMedium(m0) : 'email' }
  if (s0 === 'email') return { source: 'crm', medium: m0 ? remapMedium(m0) : 'email' }
  return { source: remapSource(s0), medium: m0 ? remapMedium(m0) : m0 }
}

function remapCampaign(raw: string, now: Date): string {
  const v = lower(raw)
  if (v === 'market-report') return marketReportCampaign(null, now)
  if (isCmaDocumentSlug(v)) return 'cma-letter'
  return CAMPAIGN_ALIASES[v] ?? v
}

function isContentAllowed(value: string): boolean {
  if (CONTENT_EXACT_SET.has(value)) return true
  if (LISTING_CONTENT_RE.test(value)) return true
  if (AGENT_CONTENT_RE.test(value)) return true
  if (!CONTENT_SLUG_RE.test(value)) return false
  if (utmValueLooksLikeAddress(value) || utmValueLooksLikePersonName(value)) return false
  return true
}

export function validateUtm(input: UtmFields, now: Date = new Date()): UtmValidationResult {
  const pair = remapPair(input.source, input.medium)
  const source = pair.source
  const medium = pair.medium
  const campaignRaw = input.campaign != null && lower(input.campaign) !== '' ? remapCampaign(input.campaign, now) : undefined
  const contentRaw = input.content != null && lower(input.content) !== '' ? lower(input.content) : undefined
  const termRaw = input.term != null && lower(input.term) !== '' ? lower(input.term) : undefined

  for (const [field, value] of [
    ['source', source],
    ['medium', medium],
    ['campaign', campaignRaw],
    ['content', contentRaw],
    ['term', termRaw],
  ] as const) {
    if (value == null) continue
    const reason = forbiddenReason(value)
    if (reason) return { ok: false, error: reason, field }
  }

  if (!isUtmSource(source)) {
    return { ok: false, error: `utm_source "${source}" is not in the allowed vocabulary`, field: 'source' }
  }
  if (!isUtmMedium(medium)) {
    return { ok: false, error: `utm_medium "${medium}" is not in the allowed vocabulary`, field: 'medium' }
  }
  const campaign = campaignRaw
  if (campaign != null && !isUtmCampaign(campaign)) {
    return { ok: false, error: `utm_campaign "${campaign}" is not a stable program slug`, field: 'campaign' }
  }
  const content = contentRaw
  if (content != null && !isContentAllowed(content)) {
    return { ok: false, error: `utm_content "${content}" is not an allowed variant`, field: 'content' }
  }
  const term = termRaw
  if (term != null) {
    if (!PAID_MEDIUMS.has(medium)) {
      return { ok: false, error: `utm_term is only allowed when medium is cpc or paid_social (got "${medium}")`, field: 'term' }
    }
    if (utmValueLooksLikeAddress(term) || utmValueLooksLikePersonName(term) || !CONTENT_SLUG_RE.test(term)) {
      return { ok: false, error: `utm_term "${term}" is not a valid paid keyword`, field: 'term' }
    }
  }

  const out: NormalizedUtm = { source, medium }
  if (campaign) out.campaign = campaign
  if (content) out.content = content
  if (term) out.term = term
  return { ok: true, value: out }
}

export function isValidUtm(input: UtmFields): input is NormalizedUtm {
  return validateUtm(input).ok
}

function isStrictUtm(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function fallbackCampaign(source: string): string {
  if (source === 'cma') return 'cma-letter'
  if (source === 'gbp') return 'gbp-profile'
  if (source === 'newsletter') return 'newsletter'
  if (source === 'facebook' || source === 'instagram' || source === 'x' || source === 'youtube') return 'social-post'
  return 'crm-outbound'
}

function fallbackMedium(source: string): UtmMedium {
  if (source === 'gbp') return 'organic'
  return 'email'
}

/**
 * Production: never throw. Test/dev: throw a clear Error so a bad call site
 * fails the suite instead of shipping an address into GA4.
 */
function normalizeForBuild(opts: BuildTrackedUrlOpts): NormalizedUtm {
  const result = validateUtm(opts)
  if (result.ok) {
    const value = { ...result.value }
    if (opts.test && value.campaign && !String(value.campaign).startsWith('test-')) {
      value.campaign = `test-${value.campaign}`
    }
    if (opts.test && !value.campaign) {
      value.campaign = 'test-crm-outbound'
    }
    return value
  }

  const message = `[utm] ${result.error}`
  if (isStrictUtm()) throw new Error(message)
  console.warn(`${message}; falling back to a known-good value`)

  const source = isUtmSource(remapSource(opts.source)) ? remapSource(opts.source) : 'crm'
  const mediumCandidate = remapMedium(opts.medium)
  const medium = isUtmMedium(mediumCandidate) ? mediumCandidate : fallbackMedium(source)
  let campaign: string | undefined
  if (opts.campaign) {
    const remapped = remapCampaign(opts.campaign, new Date())
    campaign = isUtmCampaign(remapped) ? remapped : fallbackCampaign(source)
  }
  if (opts.test) {
    campaign = `test-${campaign ?? 'crm-outbound'}`
  }
  const value: NormalizedUtm = { source: source as UtmSource, medium }
  if (campaign && isUtmCampaign(campaign)) value.campaign = campaign
  const content = opts.content ? lower(opts.content) : undefined
  if (content && isContentAllowed(content)) value.content = content
  const term = opts.term ? lower(opts.term) : undefined
  if (term && PAID_MEDIUMS.has(medium) && CONTENT_SLUG_RE.test(term) && !utmValueLooksLikeAddress(term)) {
    value.term = term
  }
  return value
}

function parseWorkingUrl(raw: string): { url: URL; htmlEscaped: boolean; relative: boolean } | null {
  const htmlEscaped = /&amp;/i.test(raw)
  const normalized = htmlEscaped ? raw.replace(/&amp;/gi, '&') : raw
  const relative = !/^https?:\/\//i.test(normalized)
  try {
    return { url: new URL(normalized, 'https://ryan-realty.com'), htmlEscaped, relative }
  } catch {
    return null
  }
}

function serializeWorkingUrl(url: URL, htmlEscaped: boolean, relative: boolean): string {
  const href = relative ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  if (!htmlEscaped) return href
  const hashAt = href.indexOf('#')
  const base = hashAt === -1 ? href : href.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : href.slice(hashAt)
  const q = base.indexOf('?')
  if (q === -1) return href
  return `${base.slice(0, q + 1)}${base.slice(q + 1).replace(/&/g, '&amp;')}${hash}`
}

function applyUtmSet(url: URL, utm: NormalizedUtm, extraParams?: Record<string, string>): void {
  if (extraParams) {
    for (const k of Object.keys(extraParams)) url.searchParams.delete(k.trim())
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key)
  }
  url.searchParams.set('utm_source', utm.source)
  url.searchParams.set('utm_medium', utm.medium)
  if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign)
  if (utm.content) url.searchParams.set('utm_content', utm.content)
  if (utm.term) url.searchParams.set('utm_term', utm.term)
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      const name = k.trim()
      const value = (v ?? '').trim()
      if (!name || name.toLowerCase().startsWith('utm_')) continue
      if (!value) {
        url.searchParams.delete(name)
        continue
      }
      url.searchParams.set(name, value)
    }
  }
}

/**
 * Stamp exactly one UTM set onto `url`. Existing utm_* params are removed
 * first. Path, hash, and non-UTM query params are preserved.
 *
 * Signature: `buildTrackedUrl(url, { source, medium, campaign, content?, term?, test?, extraParams? })`
 */
export function buildTrackedUrl(url: string, opts: BuildTrackedUrlOpts): string {
  if (typeof url !== 'string' || url.length === 0) return url
  const parsed = parseWorkingUrl(url)
  if (!parsed) {
    if (isStrictUtm()) throw new Error(`[utm] cannot parse URL: "${url}"`)
    console.warn(`[utm] cannot parse URL; leaving unchanged: "${url}"`)
    return url
  }
  const utm = normalizeForBuild(opts)
  applyUtmSet(parsed.url, utm, opts.extraParams)
  return serializeWorkingUrl(parsed.url, parsed.htmlEscaped, parsed.relative)
}

export function readExistingUtms(url: string): UtmFields & { extraDoc?: string } {
  const parsed = parseWorkingUrl(url)
  if (!parsed) return { source: '', medium: '' }
  const q = parsed.url.searchParams
  return {
    source: q.get('utm_source') ?? '',
    medium: q.get('utm_medium') ?? '',
    campaign: q.get('utm_campaign') ?? undefined,
    content: q.get('utm_content') ?? undefined,
    term: q.get('utm_term') ?? undefined,
    extraDoc: q.get(CMA_DOC_PARAM) ?? undefined,
  }
}

/**
 * Social / GBP platform → utm_source. Platforms not in the closed source list
 * use `referral-<domain>`.
 */
export function platformUtmSource(
  platform: string,
): UtmSource {
  switch (platform) {
    case 'instagram':
    case 'threads':
      return 'instagram'
    case 'facebook':
      return 'facebook'
    case 'youtube':
      return 'youtube'
    case 'x':
      return 'x'
    case 'google_business_profile':
      return 'gbp'
    case 'tiktok':
      return 'referral-tiktok.com'
    case 'linkedin':
      return 'referral-linkedin.com'
    case 'pinterest':
      return 'referral-pinterest.com'
    case 'nextdoor':
      return 'referral-nextdoor.com'
    default:
      return 'crm'
  }
}

export function platformUtmMedium(platform: string): UtmMedium {
  return platform === 'google_business_profile' ? 'organic' : 'social'
}
