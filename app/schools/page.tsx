/**
 * /schools — Central Oregon schools index, KB (kinetic-brutalist) design.
 *
 * Lists every verified school in the registry (data/co-schools.ts) grouped by
 * district, then by level, each linking to its /schools/[slug] detail page.
 *
 * RESTYLED IN PLACE to the KB design system (Phase 9): KbNav + KbFooter chrome,
 * KbHero, KB section rhythm (.section/.wrap, Amboqia display headings, hard
 * --edge borders, mono labels). No content dropped — every district, level,
 * school card, stat, JSON-LD, and CTA from the prior shadcn template is kept.
 *
 * Data ONLY through @/lib/data (Gate G8). Academic stats are intentionally
 * absent here — the registry leaves them nullable and they get enriched later
 * from a verified source (CLAUDE.md §0).
 */

import type { Metadata } from 'next'
import { getSchools, getSchoolsCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { SchoolLevel } from '@/data/co-schools'
import '@/components/site/kb/kb.css'

export const revalidate = 3600

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High schools',
  middle: 'Middle schools',
  elementary: 'Elementary schools',
}

const LEVEL_ORDER: SchoolLevel[] = ['high', 'middle', 'elementary']

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Schools',
    description:
      'Browse Central Oregon schools by district. See the homes for sale that feed each elementary, middle, and high school across Bend, Redmond, Sisters, and beyond.',
    path: '/schools',
  })
}

export default function SchoolsIndexPage() {
  const districts = getSchools()
  const total = getSchoolsCount()

  return (
    <main className="kb-root">
      <SchoolsIndexStyles />
      <KbNav />
      <KbSectionTracker pageType="schools" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Schools', url: '/schools' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon Schools',
            description:
              'Central Oregon schools by district, with the homes for sale that feed each one.',
            url: '/schools',
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Schools' }]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Schools"
          titleTop="Central Oregon"
          titleBottom="schools"
          lead={`${total} schools across ${districts.length} districts, from Bend to Madras. Pick a school to see the active homes for sale that feed it, on a map and as listings, with district context.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.schools}
        />

        {districts.length === 0 ? (
          <section className="section about" id="districts" aria-label="Schools">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Schools</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The school registry is being updated. Browse{' '}
                <a className="schools-inline-link" href="/cities">
                  Central Oregon cities
                </a>{' '}
                or{' '}
                <a className="schools-inline-link" href="/search">
                  search homes
                </a>{' '}
                in the meantime.
              </p>
            </div>
          </section>
        ) : (
          districts.map((district) => (
            <section
              key={district.districtSlug}
              className="section about"
              id={`district-${district.districtSlug}`}
              aria-label={district.district}
            >
              <div className="wrap">
                <div className="sec-head">
                  <span className="sec-index">School district</span>
                  <h2 className="sec-title display">{district.district}</h2>
                </div>

                <div className="schools-levels">
                  {LEVEL_ORDER.map((level) => {
                    const schools = district.byLevel[level]
                    if (schools.length === 0) return null
                    return (
                      <div className="schools-level" key={level}>
                        <h3 className="schools-level-title mono-lab">{LEVEL_LABEL[level]}</h3>
                        <ul className="schools-grid">
                          {schools.map((school) => (
                            <li key={school.slug}>
                              <a className="schools-card" href={`/schools/${school.slug}`}>
                                <span className="schools-card-name display">{school.name}</span>
                                <span className="schools-card-meta">
                                  <span className="schools-card-city">{school.city}</span>
                                  {school.grades ? (
                                    <span className="schools-card-grades mono-num">· {school.grades}</span>
                                  ) : null}
                                  {typeof school.greatSchoolsRating === 'number' ? (
                                    <span className="schools-card-rating mono-num">
                                      {school.greatSchoolsRating}/10
                                    </span>
                                  ) : null}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          ))
        )}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

/**
 * Route-scoped KB styling for the school-district sections (cards + level
 * groups). Scoped under `.kb-root` so it cannot leak into the shadcn site, and
 * kept here (not in the shared kb.css, which this group must not touch). Hard
 * navy edges, Amboqia card titles, mono labels — the brutalist register. Motion
 * is CSS-only (border + lift on hover) so it is safe under prefers-reduced-motion.
 */
function SchoolsIndexStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
.kb-root .about .schools-inline-link{color:var(--navy);font-weight:600;border-bottom:1px solid var(--navy-12);transition:border-color .15s ease;}
.kb-root .about .schools-inline-link:hover,.kb-root .about .schools-inline-link:focus-visible{border-color:var(--navy);outline:none;}
.kb-root .schools-levels{padding-top:clamp(26px,3.5vw,42px);display:flex;flex-direction:column;gap:clamp(34px,4vw,52px);}
.kb-root .schools-level{display:flex;flex-direction:column;gap:18px;}
.kb-root .schools-level-title{color:var(--navy-70);}
.kb-root .schools-grid{list-style:none;display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--navy-12);border-left:1px solid var(--navy-12);}
@media(min-width:640px){.kb-root .schools-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1040px){.kb-root .schools-grid{grid-template-columns:repeat(3,1fr);}}
.kb-root .schools-card{display:flex;flex-direction:column;gap:9px;height:100%;padding:20px 20px 22px;border-right:1px solid var(--navy-12);border-bottom:1px solid var(--navy-12);background:var(--cream);transition:background .18s ease,color .18s ease,box-shadow .18s ease;}
@media(hover:hover){.kb-root .schools-card:hover{background:var(--navy);color:var(--cream);box-shadow:var(--shadow-md,0 6px 22px rgba(16,39,66,.16));}}
.kb-root .schools-card:focus-visible{outline:3px solid var(--navy);outline-offset:-3px;}
.kb-root .schools-card-name{font-size:clamp(1.15rem,2.4vw,1.45rem);line-height:1.02;}
.kb-root .schools-card-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;font-size:.78rem;font-weight:600;letter-spacing:.02em;}
.kb-root .schools-card-city{color:var(--navy-70);}
.kb-root .schools-card:hover .schools-card-city{color:var(--cream-70);}
.kb-root .schools-card-grades{color:var(--navy-70);}
.kb-root .schools-card:hover .schools-card-grades{color:var(--cream-70);}
.kb-root .schools-card-rating{margin-left:auto;padding:3px 9px;border:1px solid var(--navy);font-size:.72rem;letter-spacing:.04em;}
.kb-root .schools-card:hover .schools-card-rating{border-color:var(--cream-40);color:var(--cream);}
`,
      }}
    />
  )
}
