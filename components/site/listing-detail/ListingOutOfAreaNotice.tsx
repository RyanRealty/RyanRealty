import { V3Quiet } from '@/components/site/v3'
import type { ListingOutOfAreaNotice as Notice } from './listing-out-of-area'

/**
 * SITE-33 — the honesty block on an out-of-area listing page (Matt 2026-09-08).
 *
 * It sits directly under the price strip, above everything else the page says
 * about the home, because "this is not our market" is a fact about the whole
 * page and a reader who scrolls past it has already been misled. The strip
 * above it is a filled ask; this is a hairline block; the facts below it are a
 * different form again — no two adjacent sections share a pattern.
 *
 * This file chooses the form. Every string comes from
 * buildListingOutOfAreaNotice, and the decision to render at all comes from
 * outOfAreaListingPolicy — the same predicate that sets robots to "noindex,
 * follow" on this page and drops its row from listings.xml.
 */
export function ListingOutOfAreaNotice({ notice }: { notice: Notice }) {
  return (
    <V3Quiet
      id={notice.id}
      eyebrow={notice.eyebrow}
      heading={notice.heading}
      items={[
        { kind: 'prose', body: notice.paragraphs },
        { label: notice.doorLabel, href: notice.doorHref },
      ]}
    />
  )
}
