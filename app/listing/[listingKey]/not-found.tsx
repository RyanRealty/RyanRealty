import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * Invalid, sold, or stale /listing/<key>. PublicNav still provides the header.
 * Do not remount V3Chrome. One V3Footer outside main.
 */
export default function ListingNotFound() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading="This home may no longer be on the market"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'It may have sold or been taken off the market. Here is where to look next.',
            },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Central Oregon housing market', href: '/housing-market/central-oregon' },
            { label: 'Value my home', href: valuationHref('/listing') },
            { label: 'Talk to a broker', href: '/contact' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
