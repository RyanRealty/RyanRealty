/**
 * /about opener — firm claim first, office exterior as supporting media.
 *
 * Mini 2026-09-14: H1 and purpose must read as the opening firm claim
 * (house-firm), not a caption under a navy postcard. Client reviews live
 * on V3Proof immediately after. Never the sofa interior. No broker Cards.
 */

import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { ABOUT_FIRM_STORY } from './about-constants'

export function AboutFirm({
  heading,
  id = 'firm',
  officeAlt,
  officeCaption,
  officeSrc,
}: {
  heading: string
  id?: string
  officeAlt: string
  officeCaption: string
  officeSrc: string
}) {
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'about-firm')}
      aria-labelledby="firm-heading"
    >
      <div className="about-firm__claim">
        <V3Eyebrow>Ryan Realty · Central Oregon</V3Eyebrow>
        <V3Heading level={1} id="firm-heading" className="about-firm__heading">
          {heading}
        </V3Heading>
        <p className="about-firm__purpose">{ABOUT_FIRM_STORY}</p>
      </div>
      <figure className="about-firm__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={officeSrc} alt={officeAlt} width={1600} height={1067} />
        <figcaption className="about-firm__caption">{officeCaption}</figcaption>
      </figure>
    </section>
  )
}
