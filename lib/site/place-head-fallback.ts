/**
 * What a place page's <head> does when the read behind it did not answer
 * (P3 — DATA-6, SEO-2, 2026-09-23).
 *
 * generateMetadata on /cities/[slug], /cities/[slug]/[neighborhoodSlug],
 * /communities/[slug] and /subdivisions/[slug] awaited their DAL reads bare. A
 * read that threw killed the render outside every error boundary, and Next
 * served its built-in "500 Internal Server Error." document with status 500.
 * A read that fell back to null called notFound(): a 404 for a real place,
 * written into the ISR copy.
 *
 * Now each read is raced through withTimeoutFallbackResult. A read that did not
 * answer is UNKNOWN, not absent (§0): the head keeps the page's canonical path,
 * names the place from its own URL, emits no noindex it cannot prove, and
 * limits the copy's ISR lifetime so the real head replaces it within
 * DEGRADED_ISR_REVALIDATE_S. notFound() stays only for a read that answered
 * "no such place".
 */
import { titleCasePlaceName } from '@/lib/market/publish-plat-display-name'
import { refuseDegradedIsr } from '@/lib/site/degraded-isr'

/** Longest a head read may hold the render before the head degrades. */
export const PLACE_HEAD_READ_MS = 8000

/** Place name from a URL slug, for a head whose name read did not answer: 'la-pine' → 'La Pine'. */
export function placeNameFromSlug(slug: string): string {
  const words = slug
    .trim()
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  return words.length === 0 ? '' : titleCasePlaceName(words.join(' '))
}

/** Mark this render's head as degraded: its ISR copy stands for the short window only. */
export async function noteDegradedHead(pageLabel: string, readLabel: string): Promise<void> {
  await refuseDegradedIsr(`${pageLabel}:head`, [readLabel])
}
