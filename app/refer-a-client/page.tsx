// @no-parity — new agent-facing capture on the v3 barrel. No Wave 3 mockup.
// Visual target is design_system/public/PUBLIC_UI.md, same as /join.
/**
 * /refer-a-client — incoming broker-to-broker referrals.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Opens on Stage (owned
 * office photo) then Ledger then Sheet then Quiet. Chrome: layout mounts
 * V3Chrome. V3Footer outside <main>.
 *
 * Dual objectives in the IA lock. Capture is
 * submitInboundAgentReferral. No outbound to the client or the sending agent.
 */

import { getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildJsonLd } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { ReferSheet } from './_v3/ReferSheet.client'
import { OFFICE_HERO, REFER_FACTS, REFER_FAQ_ITEMS, REFER_QUIET } from './_v3/refer-constants'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Refer a client to Central Oregon',
  description:
    'Licensed brokers can send a buyer or seller to Bend and Central Oregon. We take the file. The referral we record is 25 percent of our side at close.',
  path: '/refer-a-client',
  ogImage: OFFICE_HERO,
  keywords: [
    'refer a client Bend realtor',
    'Bend Oregon realtor referral',
    'Central Oregon referral realtor',
    'send a buyer to Bend',
  ],
})

export default async function ReferAClientPage() {
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/refer-a-client',
    fallback: OFFICE_HERO,
  })
  const [firstFact, ...restFacts] = REFER_FACTS

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        {[
          {
            type: 'webPage' as const,
            name: 'Refer a client to Central Oregon',
            description:
              'Licensed brokers can send a buyer or seller to Ryan Realty in Central Oregon. The receiving brokerage takes the file.',
            url: '/refer-a-client',
          },
          {
            type: 'breadcrumb' as const,
            items: [
              { name: 'Home', url: '/' },
              { name: 'Refer a client', url: '/refer-a-client' },
            ],
          },
          {
            type: 'faqPage' as const,
            items: [...REFER_FAQ_ITEMS],
          },
        ].map((input, i) => (
          <script
            key={`${input.type}-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(input)) }}
          />
        ))}
        <V3Breadcrumb
          tone="on-media"
          belowNav
          trail={[{ label: 'Home', href: '/' }, { label: 'Refer a client' }]}
        />

        <V3Stage
          id="refer"
          headingLevel={1}
          eyebrow="For licensed brokers"
          headline="Refer a client to Central Oregon"
          posterSrc={heroSrc ?? OFFICE_HERO}
          action={{ label: 'Send the referral', href: '#refer-form' }}
        />

        {firstFact ? (
          <V3Ledger
            id="how-it-works"
            eyebrow={v3Text('How it works')}
            heading={v3Text('We take the file')}
            note={v3Text(
              'You keep the relationship with the sending side. We work the Central Oregon side.',
            )}
            rows={[firstFact, ...restFacts]}
          />
        ) : null}

        <ReferSheet />

        <V3Quiet
          id="after"
          eyebrow="After you send it"
          heading="Written referral first"
          items={REFER_QUIET}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
