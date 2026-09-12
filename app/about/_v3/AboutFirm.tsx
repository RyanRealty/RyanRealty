/**
 * /about hero — firm story on the office exterior, not Meet the Team.
 *
 * Compass/SIR brief: full-bleed mood photo + one purpose line.
 * Matt 2026-09-12: boutique · Central Oregon · buy and sell.
 * Client reviews live on V3Proof immediately after this hero — not a thin
 * score link on the firm story. Never the sofa interior. No broker Cards.
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
      <figure className="about-firm__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={officeSrc} alt={officeAlt} width={1600} height={1067} />
        <figcaption className="about-firm__caption">{officeCaption}</figcaption>
        <div className="about-firm__mission">
          <V3Eyebrow onMedia>Ryan Realty · Central Oregon</V3Eyebrow>
          <V3Heading level={1} id="firm-heading" onMedia className="about-firm__heading">
            {heading}
          </V3Heading>
          <p className="about-firm__purpose">{ABOUT_FIRM_STORY.join(' ')}</p>
        </div>
      </figure>
    </section>
  )
}
