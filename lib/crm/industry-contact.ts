/**
 * Durable broker / industry-contact flag for CRM people.
 *
 * Standard tag: industry:contact. Also honors the existing industry:realtor
 * and segment:vendor tags plus exact industry stages. This is a TARGETING
 * exclusion (never bulk / drip / list / ad), not a consent suppression —
 * the 1:1 admin composer must still send.
 *
 * Send-time matching is exact tags + exact stages. The backfill classifier
 * may also use an exact source. Fuzzy "agent" substrings and person names
 * stay ambiguous and are left untouched.
 */

export const INDUSTRY_CONTACT_TAG = 'industry:contact' as const

export const INDUSTRY_BULK_SKIP_REASON = 'industry:contact' as const

/** Exact stages that mark an industry contact at send time. Case-insensitive. */
export const INDUSTRY_CONTACT_STAGES: readonly string[] = [
  'real estate agent',
  'vendor',
  'broker',
  'lender',
  'realtor',
]

/** Exact tags that mark an industry contact at send time. Case-insensitive. */
export const INDUSTRY_EXACT_TAGS: readonly string[] = [
  INDUSTRY_CONTACT_TAG,
  'industry:realtor',
  'industry:broker',
  'industry:lender',
  'industry:vendor',
  'industry:agent',
  'segment:vendor',
  'realtor',
  'realtor:local',
  'realtor:migration',
  'audience:broker-recruit',
  'broker-recruit',
  'broker',
  'lender',
  'vendor',
  'real-estate-agent',
  'real estate agent',
  'principal-broker',
  'migration broker',
  'source:realtor',
  'source:broker',
  'source:lender',
  'source:vendor',
]

const INDUSTRY_EXACT_TAG_SET = new Set(INDUSTRY_EXACT_TAGS)
const INDUSTRY_STAGE_SET = new Set(INDUSTRY_CONTACT_STAGES)

/** Exact crm_people.source values the backfill may treat as industry. */
export const INDUSTRY_EXACT_SOURCES: readonly string[] = [
  'realtor',
  'broker',
  'lender',
  'vendor',
  'real estate agent',
  'industry:realtor',
  'broker-recruit',
  'audience:broker-recruit',
  'migration broker',
]

const INDUSTRY_EXACT_SOURCE_SET = new Set(INDUSTRY_EXACT_SOURCES)

export type IndustryPerson = {
  tags?: unknown
  stage?: string | null
}

export type IndustryReclassInput = IndustryPerson & {
  source?: string | null
}

export type IndustryReclassDecision = 'flag' | 'ambiguous'

function normalizeToken(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function isClearIndustryTag(low: string): boolean {
  if (!low) return false
  if (INDUSTRY_EXACT_TAG_SET.has(low)) return true
  if (low.startsWith('realtor:')) return true
  // City realtor tags from the FUB migration ("Bend realtor").
  if (low !== 'realtor' && low.endsWith(' realtor')) return true
  if (low.startsWith('industry:')) {
    const rest = low.slice('industry:'.length)
    return rest === 'realtor' || rest === 'broker' || rest === 'lender' || rest === 'vendor' || rest === 'agent' || rest === 'contact'
  }
  return false
}

function tagsOf(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  for (const t of tags) {
    const low = normalizeToken(t)
    if (low) out.push(low)
  }
  return out
}

/** True when tags or stage clearly mark a broker / agent / lender / vendor. */
export function isIndustryContact(input: IndustryPerson): boolean {
  const stage = normalizeToken(input.stage)
  if (stage && INDUSTRY_STAGE_SET.has(stage)) return true
  return tagsOf(input.tags).some(isClearIndustryTag)
}

/**
 * Backfill classifier. Flag only a clear industry identity. An exact source
 * may flag when tags/stage do not; names and fuzzy "agent" do not.
 */
export function classifyIndustryReclass(input: IndustryReclassInput): IndustryReclassDecision {
  if (isIndustryContact(input)) return 'flag'
  const source = normalizeToken(input.source)
  if (source && INDUSTRY_EXACT_SOURCE_SET.has(source)) return 'flag'
  return 'ambiguous'
}

/** Append industry:contact when missing. PURE. */
export function withIndustryContactTag(tags: unknown): string[] {
  const list = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    : []
  if (list.some((t) => t.trim().toLowerCase() === INDUSTRY_CONTACT_TAG)) return list
  return [...list, INDUSTRY_CONTACT_TAG]
}
