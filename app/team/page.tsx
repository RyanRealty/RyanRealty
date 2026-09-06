/**
 * /team - broker roster, on the components/site/v3 barrel.
 *
 * PAGE_INVENTORY §6 / PAGE_OUTLINE /team: roster only. Same house of faces
 * as About's broker row — not a second About. Call/Text. Door to each
 * /team/[slug].
 *
 * THE PAGE CONTRACT: export const metadata through pageMetadata,
 * MetadataBlock JSON-LD (CollectionPage + aboutOrganization +
 * BreadcrumbList), V3SectionTracker pageType="team".
 *
 * D11: no virtue names. No invented quote.
 *
 * Parity: design_system/ryan-realty/ui_kits/team/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from './_v3/team-constants'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'The broker you call is the broker who works the deal. Every Ryan Realty listing gets video, a 3D walkthrough, and a price from live Central Oregon comps.',
  path: '/team',
  ogImage: '/images/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

export default async function TeamPage() {
  const brokers = await getBrokers()

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const schemas: SchemaInput[] = [
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      aboutOrganization: true,
      name: 'The Ryan Realty Team',
      description:
        'The licensed Oregon brokers behind Ryan Realty in Bend, serving buyers and sellers across Central Oregon.',
      url: '/team',
    },
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Team', url: '/team' },
      ],
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Team' }]} />

        <AboutFaces people={faces} heading="The brokers" />
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
