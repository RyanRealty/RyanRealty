/**
 * /about firm hero. Office + who we are. Not a broker roster.
 *
 * Looking brief: this is item 1 (firm hero). Reviews are the next band.
 * AboutFaces / three equal broker Cards stay off this page.
 */

import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import './about-fold.css'

export function AboutFirmHero({
  heading,
  eyebrow,
  beat,
  office,
}: {
  heading: string
  eyebrow: string
  beat: string
  office: { src: string; alt: string; caption: string }
}) {
  const paragraphs = beat
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <section id="firm" className={cn(V3_ROOT_CLASS, 'about-firm')} aria-labelledby="firm-heading">
      <div className="about-firm__copy">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={1} id="firm-heading">
          {heading}
        </V3Heading>
        {paragraphs.map((p) => (
          <p key={p.slice(0, 48)} className="about-firm__beat">
            {p}
          </p>
        ))}
      </div>
      <figure className="about-firm__place">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={office.src} alt={office.alt} width={640} height={640} />
        <figcaption>{office.caption}</figcaption>
      </figure>
    </section>
  )
}
