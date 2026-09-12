/**
 * /about hero — firm story on the office exterior, not Meet the Team.
 *
 * Compass/SIR brief: full-bleed mood photo + one purpose line.
 * Matt 2026-09-12: boutique · Central Oregon · buy and sell.
 * Reviews proof (score + featured Google quote) sits on the hero.
 * Never the sofa interior. No broker Cards. No methodology chrome.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { ABOUT_FIRM_STORY } from './about-constants'

export type AboutFirmProof = {
  value: string
  count: number
  href: string
}

export type AboutFirmQuote = {
  pull: string
  author: string
}

export function AboutFirm({
  heading,
  id = 'firm',
  officeAlt,
  officeCaption,
  officeSrc,
  proof,
  quote,
}: {
  heading: string
  id?: string
  officeAlt: string
  officeCaption: string
  officeSrc: string
  proof?: AboutFirmProof
  quote?: AboutFirmQuote
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
      {proof || quote ? (
        <div className="about-firm__reviews">
          {proof ? (
            <Button asChild variant="link">
              <Link href={proof.href}>
                {proof.value} from {proof.count} Google reviews
              </Link>
            </Button>
          ) : null}
          {quote ? (
            <blockquote className="about-firm__quote">
              <p>{quote.pull}</p>
              <cite>{quote.author}</cite>
            </blockquote>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
