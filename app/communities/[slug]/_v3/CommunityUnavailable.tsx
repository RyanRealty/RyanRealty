import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * The refusal body for a /communities/<city>-<token> URL whose place name
 * cannot be resolved to anything real (SITE-28).
 *
 * WHY RENDERED AND NOT THROWN. Identical mechanism to
 * app/subdivisions/[slug]/SubdivisionUnavailable.tsx: this route renders under
 * app/loading.tsx's Suspense boundary, so React flushes the shell — and HTTP
 * 200 with it — before the page component resolves. A notFound() throw here
 * cannot set a status; what would ship is a hollow 200 with no <h1>. So the
 * refusal is a real body with a real <h1>, and the 200 is honest about it.
 *
 * WHY NOT A 404 AT THE EDGE. Two reasons, both measured. The resolver that
 * would have to make that call is contractually pure and synchronous
 * (lib/routing/pre-render-hops.ts, ci:streamed-redirect), so it cannot tell a
 * real plat from a typo; and an earlier attempt to reject junk slugs at the
 * edge read a degraded cache as absence and 404-ed /communities/tetherow
 * itself. It is also the wrong answer on the merits — the compound set holds
 * pages ranking at position 1.0.
 *
 * ROBOTS IS UNCHANGED. The page keeps the "noindex, follow" every compound
 * non-community slug already carried since 95672822 (2026-08-27), emitted by
 * communityMetadataInput. This item changes the words, not the crawl rule.
 *
 * The visitor is not left at a dead end: the doors below are the same set the
 * subdivision refusal offers, plus the city the URL named when we know it —
 * the city IS resolved (it is the slug's own prefix, checked against the city
 * set), it is only the place name that is not.
 */
export function CommunityUnavailable({
  city,
  citySlug,
}: {
  city?: string | null
  citySlug?: string | null
}) {
  const cityDoor =
    city && citySlug
      ? [{ label: `Homes for sale in ${city}`, href: `/cities/${citySlug}` }]
      : []
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading="No community at this address"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'The MLS files some homes under a code rather than a place name, and this address is one of them. Rather than print the code as if it were a neighborhood, here is where to look next.',
            },
            ...cityDoor,
            { label: 'Every community', href: '/communities' },
            { label: 'Every recorded subdivision', href: '/subdivisions' },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Value my home', href: valuationHref('/communities') },
            { label: 'Talk to a broker', href: '/contact' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
