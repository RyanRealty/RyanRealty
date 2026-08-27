import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * The ONE refusal body for a /subdivisions/<slug> URL that resolves to no place.
 *
 * THE DEFECT IT REPLACES. The page's three-path contract ends in `notFound()`
 * when a slug has no GIS boundary, no registry alias, and no listings. That
 * throw could never set a status: /subdivisions/[slug] renders dynamically and
 * `app/loading.tsx` puts every route inside a Suspense boundary, so React
 * flushes the shell — and HTTP 200 with it — before the page component
 * resolves. Next then emits NEXT_HTTP_ERROR_FALLBACK;404 for the CLIENT to swap
 * after hydration and never writes the not-found body into the committed
 * stream. What shipped for a junk slug was 200, the layout chrome, a <title>
 * built by title-casing the slug, and zero <h1>. Same mechanism, same
 * measurement, and the same answer as components/site/listing-detail/
 * ListingUnavailable.tsx: RENDER the refusal, do not throw it.
 *
 * The three legitimate paths are untouched. A plat with a GIS polygon, a
 * registry alias, or live listings still renders its full page, and a slug
 * whose boundary or inventory read DEGRADED (timed out or threw) still renders
 * too, because §0 says unknown is not empty and a slow query must not delete a
 * real plat.
 *
 * Paired with SUBDIVISION_UNAVAILABLE_METADATA: noindex is what keeps the
 * unavoidable 200 out of the index.
 */
export function SubdivisionUnavailable() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading="No subdivision at this address"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'Nothing is recorded under this name in Central Oregon. Here is where to look next.',
            },
            { label: 'Every recorded subdivision', href: '/subdivisions' },
            { label: 'Communities', href: '/communities' },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Value my home', href: valuationHref('/subdivisions') },
            { label: 'Talk to a broker', href: '/contact' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

/**
 * Metadata for the refusal. `index: false` is the load-bearing field: the
 * response is a 200 the route cannot downgrade, so noindex is what stops a page
 * naming a place that does not exist from entering the index. No canonical —
 * never canonicalise a URL we are refusing to serve.
 */
export const SUBDIVISION_UNAVAILABLE_METADATA = {
  title: 'No subdivision at this address',
  robots: { index: false, follow: true },
} as const
