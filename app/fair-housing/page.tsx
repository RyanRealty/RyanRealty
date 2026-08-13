/**
 * /fair-housing - Equal Housing Opportunity, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 * Equal Housing mark stays: it is the HUD identifier, not a second language.
 *
 * VISITOR OBJECTIVE: Understand the brokerage’s fair-housing commitment and
 * the correct complaint channel, routed to HUD.
 * MACHINE OBJECTIVE: Keep the license’s fair-housing compliance surface intact.
 * EXITS: HUD complaint URL, /
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static legal page, no DAL access needed.
import type { Metadata } from 'next'
import EqualHousing from '@/components/legal/EqualHousing'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'

const siteUrl = getCanonicalSiteUrl()
const ogImage = `${siteUrl}/api/og?type=default`
const HUD_URL = 'https://www.hud.gov/program_offices/fair_housing_equal_opp'
const HUD_PHONE = '1-800-669-9777'

export const metadata: Metadata = {
  title: 'Fair Housing',
  description: 'Equal Housing Opportunity at Ryan Realty, and how to file a fair housing complaint.',
  alternates: { canonical: `${siteUrl}/fair-housing` },
  openGraph: {
    title: 'Fair Housing | Ryan Realty',
    description: 'Equal Housing Opportunity at Ryan Realty, and how to file a fair housing complaint.',
    url: `${siteUrl}/fair-housing`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'Equal Housing Opportunity',
    body: 'Ryan Realty follows the Fair Housing Act and all applicable state and local laws. We do not discriminate on the basis of race, color, religion, sex, national origin, familial status, or disability.',
  },
  {
    kind: 'prose',
    term: 'Fair Housing Act',
    body: 'The Fair Housing Act prohibits discrimination in the sale, rental, or financing of housing based on: race, color, religion, sex, national origin, familial status, and disability. We apply those protections to every client and every visitor.',
  },
  {
    kind: 'prose',
    term: 'Oregon law',
    body: 'Oregon law provides additional protected classes. We comply with all Oregon fair housing and civil rights requirements.',
  },
  {
    kind: 'prose',
    term: 'If you believe you have been discriminated against',
    body: `The U.S. Department of Housing and Urban Development (HUD) investigates fair housing complaints. Contact HUD at ${HUD_PHONE}.`,
  },
  {
    kind: 'prose',
    term: 'How we work',
    body: 'Equal housing opportunity is the baseline here. Every client gets the same service, without discrimination.',
  },
  { label: 'HUD Fair Housing', href: HUD_URL },
  { label: `Call HUD ${HUD_PHONE}`, href: `tel:${HUD_PHONE.replace(/\D/g, '')}` },
]

export default function FairHousingPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="legal" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Fair housing' }]} />

        <EqualHousing size="large" className="text-primary" />

        <V3Quiet
          id="fair-housing"
          heading="Fair housing"
          headingLevel={1}
          items={ITEMS}
        />

        <V3Ledger
          id="next"
          eyebrow={v3Text('Next')}
          heading={v3Text('Back to the site')}
          rows={[
            {
              href: '/',
              when: v3Text('Home'),
              what: v3Text('Ryan Realty home'),
              detail: v3Text('Central Oregon listings'),
            },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
