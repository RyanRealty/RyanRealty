/**
 * Lead person-page v3 redesign flag.
 *
 * Default OFF. Turn on for a person page with `?v=3` or `?lead-page-v3=1`.
 * `?v=2` / `?lead-page-v3=0` force the current layout and clear the cookie.
 * Cookie `rr_lead_page_v3=1` keeps v3 on after the query is dropped.
 */
export const LEAD_PAGE_V3_FLAG = 'lead-page-v3'
export const LEAD_PAGE_V3_COOKIE = 'rr_lead_page_v3'
export const LEAD_PAGE_V3_QUERY = 'v'

export type LeadPageV3Search = {
  v?: string | string[] | null
  'lead-page-v3'?: string | string[] | null
}

function one(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function isOn(raw: string): boolean {
  return raw === '1' || raw === 'true' || raw === 'on' || raw === '3'
}

function isOff(raw: string): boolean {
  return raw === '0' || raw === 'false' || raw === 'off' || raw === '2'
}

/** Pure: query wins, then cookie. Missing both → off. */
export function isLeadPageV3Enabled(input: {
  searchParams?: LeadPageV3Search | null
  cookie?: string | null
}): boolean {
  const v = one(input.searchParams?.v)
  if (isOff(v)) return false
  if (v === '3') return true
  const named = one(input.searchParams?.[LEAD_PAGE_V3_FLAG])
  if (isOff(named)) return false
  if (isOn(named)) return true
  return one(input.cookie) === '1'
}

/** Header actions the person page shows. v3 keeps Call + overflow only. */
export function personPageHeaderActions(v3: boolean): ReadonlyArray<
  'text' | 'message' | 'call' | 'email' | 'cma' | 'tools' | 'more'
> {
  return v3 ? ['call', 'more'] : ['text', 'message', 'call', 'email', 'cma', 'tools']
}
