/**
 * The one way to link to the valuation spine from a content page.
 *
 * WHY THIS EXISTS: the valuation ask carries `?from=<originating path>`, which the
 * seller flow turns into CRM source attribution (app/lp/seller-home-value/actions.ts,
 * sourceUrl). The KB pages built that query string inline, one page at a time
 * (components/site/kb/KbMarketHud.client.tsx). The first v3 migrations dropped it on
 * four routes at once, because an inline convention is invisible to whoever rewrites
 * the section. Attribution loss is silent: the lead still arrives, it just stops
 * saying which page produced it, and completed valuations per page is the program's
 * KPI.
 *
 * Use this for every valuation link on a content surface. The spine's own on-page form
 * does not need it (the form already knows its host path).
 */
import { VALUATION_FORM } from '@/lib/site-nav'

/**
 * @param fromPath the originating route, e.g. '/housing-market/central-oregon'. Pass a
 *   site-relative path; anything else is dropped rather than sent, because the consumer
 *   only accepts a simple relative path (sanitizePagePath in the seller action).
 */
export function valuationHref(fromPath: string | null | undefined): string {
  const base = VALUATION_FORM.href
  const path = typeof fromPath === 'string' ? fromPath.trim() : ''
  if (!path.startsWith('/') || path.startsWith('//')) return base
  const sep = base.includes('?') ? '&' : '?'
  // The anchor has to stay last or the browser reads it as part of the query value.
  const [beforeHash, hash] = base.split('#')
  const withFrom = `${beforeHash}${sep}from=${encodeURIComponent(path)}`
  return hash ? `${withFrom}#${hash}` : withFrom
}
