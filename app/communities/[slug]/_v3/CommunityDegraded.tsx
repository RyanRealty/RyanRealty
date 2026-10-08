import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { cityHref } from '@/lib/site/place-href'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * The honest body for a /communities/<slug> render whose community read did not
 * answer (SITE-214).
 *
 * WHY RENDERED. generateMetadata already treats a read that timed out or threw
 * as UNKNOWN (lib/site/place-head-fallback.ts) and keeps the page's path. The
 * body used to await the same read bare, so a read that threw ended in
 * app/communities/[slug]/error.tsx: a hollow 200 whose H1 was "This community
 * didn't load", which a crawler indexes as the page. This renders a real H1 for
 * a community the registry (or the URL) names, with no figure on it.
 *
 * NO FIGURES (§0). Unknown is not zero: no count and no median print here.
 *
 * ISR LIFETIME. The read that led here went through withTimeoutFallbackResult,
 * which notes the degrade, and the route renders inside runPublishedPageRender,
 * so this copy stands for DEGRADED_ISR_REVALIDATE_S (60 s) and no longer
 * (lib/site/degraded-isr.ts). Robots stay as the head emitted them.
 */
export function CommunityDegraded({
  name,
  city,
  citySlug,
}: {
  name: string
  city?: string | null
  citySlug?: string | null
}) {
  const cityDoor =
    city && citySlug
      ? [{ label: `Homes for sale in ${city}`, href: cityHref(citySlug) ?? `/cities/${citySlug}` }]
      : []
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="degraded"
          heading={`${name} homes for sale`}
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: `The live homes for ${name} did not load just now. Try again shortly, or start from one of these.`,
            },
            ...cityDoor,
            { label: 'Every community', href: '/communities' },
            { label: 'Value my home', href: valuationHref('/communities') },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
