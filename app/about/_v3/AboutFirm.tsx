/**
 * /about opener — faces at display scale, then the firm claim.
 *
 * SITE-163: a broker face opens the page. H1 stays branded. One boutique
 * Central Oregon buy-and-sell sentence. 5.0 from 25 stays. Not a downtown
 * storefront postcard. Not a KPI grid. Not three broker Cards.
 * Deep bios stay on /team. Office photo lives on AboutOffice.
 */

import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { ABOUT_FIRM_STORY } from './about-constants'
import { AboutFirmFaces, type AboutFirmProof } from './AboutFirmFaces.client'
import type { AboutFace } from './about-faces'

export function AboutFirm({
  heading,
  id = 'firm',
  people,
  proof,
}: {
  heading: string
  id?: string
  people: readonly AboutFace[]
  proof: AboutFirmProof | null
}) {
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'about-firm')}
      aria-labelledby="firm-heading"
    >
      <AboutFirmFaces people={people} proof={proof} />
      <div className="about-firm__claim">
        <V3Eyebrow>Ryan Realty · Central Oregon</V3Eyebrow>
        <V3Heading level={1} id="firm-heading" className="about-firm__heading">
          {heading}
        </V3Heading>
        <p className="about-firm__purpose">{ABOUT_FIRM_STORY}</p>
      </div>
    </section>
  )
}
