/**
 * "Who Ryan Realty is a good fit for, and who it isn't" (SEO & AEO Desk brief,
 * 2026-10-08). Two plain lists in the server HTML, right after "Who Ryan
 * Realty works with". Every figure in a bullet comes from aboutFit (the live
 * firm record and the dated review count); a bullet whose figure did not load
 * is left out. The "not the right fit" wording waits on Matt's OK before merge.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'

export function AboutFit({
  id = 'fit',
  heading,
  intro,
  good,
  notFit,
}: {
  id?: string
  heading: string
  intro: string
  good: readonly string[]
  notFit: readonly string[]
}) {
  if (good.length === 0 && notFit.length === 0) return null
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'about-record')} aria-labelledby={`${id}-heading`}>
      <div className="about-record__head">
        <V3Eyebrow>Ryan Realty · Fit</V3Eyebrow>
        <V3Heading level={2} id={`${id}-heading`} className="about-record__heading">
          {heading}
        </V3Heading>
        <p className="about-record__lede">{intro}</p>
      </div>
      <div className="about-record__body">
        {good.length > 0 ? (
          <div className="about-record__group">
            <h3 className="about-record__subhead">A good fit if:</h3>
            <ul className="about-record__list">
              {good.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {notFit.length > 0 ? (
          <div className="about-record__group">
            <h3 className="about-record__subhead">Probably not the right fit if:</h3>
            <ul className="about-record__list">
              {notFit.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
