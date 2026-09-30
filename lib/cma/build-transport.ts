/**
 * lib/cma/build-transport.ts: which bill pays for a CMA build's comp judge and
 * adversarial accuracy audit.
 *
 * CHOICE (Matt 2026-09-15): the expired Auto-CMA build (request_source
 * expired-listing-cron) runs its judge and audit on the Cursor subscription
 * (cursor-agent), so they do not spend the xAI key.
 *
 * CHOICE (Matt 2026-09-29): when the Cursor CLI is not on the host, the build
 * uses the xAI key. The build worker runs on Vercel, which has no cursor-agent,
 * so the Cursor-only rule made grokConfigured() false for every automatic
 * build: the judge and audit were skipped and every expired CMA landed
 * unvetted, unsendable until a broker rebuilt it. Cursor still pays wherever
 * it is installed.
 *
 * Manual /admin/cmas rebuilds and every other request source keep the default
 * transport (xAI, or GROK_TRANSPORT when set).
 */

import { cursorCliPresent, type GrokTransport } from '@/lib/grok/transport'

export const EXPIRED_AUTO_CMA_SOURCE = 'expired-listing-cron'

/** The transport to force for this build, or null to keep the default. */
export function cmaBuildGrokTransport(
  requestSource: string | null | undefined,
  cursorAvailable: () => boolean = cursorCliPresent,
): GrokTransport | null {
  if (requestSource !== EXPIRED_AUTO_CMA_SOURCE) return null
  return cursorAvailable() ? 'cursor' : null
}
