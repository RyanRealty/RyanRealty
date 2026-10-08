/**
 * "Who we help" (SEO & AEO Desk brief 2026-10-08, reworded per Matt the same
 * day: "Keep it wide open, we're the right fit for every single person." The
 * brief's second list, of clients we would turn away, is cut, and the about
 * lock forbids that framing in About copy). One plain list in the server HTML, right
 * after "Who Ryan Realty works with". Every line states who we serve; none
 * says who we don't. Each figure comes from aboutWhoWeHelp (the live firm
 * record and the dated review count); a line whose figure did not load is
 * left out.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'

export function AboutWhoWeHelp({
  id = 'who-we-help',
  heading,
  intro,
  lines,
}: {
  id?: string
  heading: string
  intro: string
  lines: readonly string[]
}) {
  if (lines.length === 0) return null
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'about-record')} aria-labelledby={`${id}-heading`}>
      <div className="about-record__head">
        <V3Eyebrow>Ryan Realty · Clients</V3Eyebrow>
        <V3Heading level={2} id={`${id}-heading`} className="about-record__heading">
          {heading}
        </V3Heading>
        <p className="about-record__lede">{intro}</p>
      </div>
      <div className="about-record__body">
        <ul className="about-record__list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
