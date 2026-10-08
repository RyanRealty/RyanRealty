/**
 * /about opener — faces at display scale, then the firm claim.
 *
 * SITE-163: a broker face opens the page. H1 stays branded. 5.0 from 25
 * stays. Not a downtown storefront postcard. Not a KPI grid. Not three
 * broker Cards. Deep bios stay on /team. Office photo lives on AboutOffice.
 *
 * THE DEK IS THE DIRECT ANSWER (SEO & AEO Desk brief, 2026-10-08, pending
 * Matt's OK). Under the H1 the page answers "what is Ryan Realty" in one
 * plain server-rendered paragraph of sourced facts (founded 2014, Bend office
 * June 2023, the license, the recorded closings, the Google rating, the fee),
 * then its source line and a freshness line. It replaces the one-sentence
 * purpose line of 2026-09-14 (ABOUT_FIRM_STORY), which now describes the page
 * in its AboutPage JSON-LD instead. The paragraph is a <p>, never an image,
 * accordion, or client component, so crawlers and answer engines read it.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { AboutFirmFaces, type AboutFirmProof } from './AboutFirmFaces.client'
import type { AboutFace } from './about-faces'
import type { AboutRichText } from './about-record'

export function AboutFirm({
  heading,
  id = 'firm',
  people,
  proof,
  answer,
  source,
  freshness,
}: {
  heading: string
  id?: string
  people: readonly AboutFace[]
  proof: AboutFirmProof | null
  /** The direct answer, built by aboutDirectAnswer from the live figures. */
  answer: string
  /** Where the answer's figures come from. */
  source?: AboutRichText
  /** "Updated ... · Figures as of ...". */
  freshness?: string
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
        <p className="about-firm__purpose about-firm__answer">{answer}</p>
        {source && source.length > 0 ? (
          <p className="about-firm__source">
            {source.map((part, index) =>
              typeof part === 'string' ? (
                <span key={index}>{part}</span>
              ) : (
                <Link key={index} href={part.href}>
                  {part.label}
                </Link>
              ),
            )}
          </p>
        ) : null}
        {freshness ? <p className="about-firm__fresh">{freshness}</p> : null}
      </div>
    </section>
  )
}
