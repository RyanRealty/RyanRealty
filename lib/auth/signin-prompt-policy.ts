/**
 * When the global SignInPrompt may auto-open.
 * Shoppers must be able to read listing results (including a $0 warehouse
 * empty state) without a signup wall. Second-pageview engagement still
 * applies on non-results routes.
 */

const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password'])
const LEAD_PATHS = new Set(['/contact', '/sell/valuation', '/refer-a-client', '/join'])

export type SignInPromptSkipReason =
  | 'outreach'
  | 'landing'
  | 'ad'
  | 'auth'
  | 'lead'
  | 'not-found'
  | 'browse'
  | 'guide'

/**
 * Blog guides read clean (Matt 2026-09-07). A reader arriving from a search
 * result or an answer engine was getting the alerts wall on the first scroll;
 * the listing-alert ask belongs on search and place pages, where the reader
 * is shopping.
 */
export function isGuidePath(pathname: string): boolean {
  const p = (pathname || '/').split(/[?#]/, 1)[0]
  return p === '/blog' || p.startsWith('/blog/')
}

export function isListingResultsPath(pathname: string): boolean {
  const p = (pathname || '/').split(/[?#]/, 1)[0]
  return (
    p === '/homes-for-sale' ||
    p.startsWith('/homes-for-sale/') ||
    p === '/search' ||
    p.startsWith('/search/')
  )
}

export function signInPromptSkipReason(input: {
  pathname: string
  fromAdClick?: boolean
  fromOutreachClick?: boolean
  isNotFound?: boolean
}): SignInPromptSkipReason | null {
  const pathname = input.pathname || '/'
  if (input.fromOutreachClick) return 'outreach'
  if (pathname.startsWith('/lp/')) return 'landing'
  if (input.fromAdClick) return 'ad'
  if (AUTH_PATHS.has(pathname)) return 'auth'
  if (LEAD_PATHS.has(pathname)) return 'lead'
  if (input.isNotFound) return 'not-found'
  if (isListingResultsPath(pathname)) return 'browse'
  if (isGuidePath(pathname)) return 'guide'
  return null
}

export function shouldAutoOpenSignInPrompt(input: {
  userPresent: boolean
  pathname: string
  hasNextParam: boolean
  fromAdClick: boolean
  fromOutreachClick: boolean
  isNotFound: boolean
  dismissed: boolean
  sessionPageviews: number
}): boolean {
  if (input.userPresent) return false
  if (signInPromptSkipReason(input)) return false
  if (input.hasNextParam) return true
  if (input.dismissed) return false
  return input.sessionPageviews >= 2
}
