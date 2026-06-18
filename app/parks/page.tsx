/**
 * /parks — Central Oregon parks index, KB (kinetic-brutalist) design.
 *
 * Lists every park in the registry (data/co-parks.ts) grouped by city, each
 * linking to its /parks/[slug] detail page. The data is verified + cited
 * (state-park polygons + facts from Oregon State Parks, city parks from BPRD /
 * city sites + OpenStreetMap) — nothing is invented (CLAUDE.md §0).
 *
 * RESTYLED IN PLACE to the KB design system (Phase 9): KbNav + KbFooter chrome,
 * KbHero, KB section rhythm (.section/.wrap, Amboqia display headings, hard
 * --edge borders, mono labels). No content dropped — every city group, park
 * card, type badge, acreage stat, JSON-LD, and CTA from the prior shadcn
 * template is kept.
 *
 * Data ONLY through @/lib/data (Gate G8).
 */

import type { Metadata } from 'next'
import { getParks, getParksCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { ParkType } from '@/data/co-parks'
import '@/components/site/kb/kb.css'

export const revalidate = 3600

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Parks',
    description:
      'Browse the notable parks across Central Oregon, from Smith Rock and Tumalo to Drake Park and Shevlin. See the homes for sale near each park on a map, with trails, river access, and amenities.',
    path: '/parks',
  })
}

export default function ParksIndexPage() {
  const cities = getParks()
  const total = getParksCount()

  return (
    <main className="kb-root">
      <ParksIndexStyles />
      <KbNav />
      <KbSectionTracker pageType="parks" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Parks', url: '/parks' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon Parks',
            description:
              'Central Oregon parks by city, with the homes for sale near each one.',
            url: '/parks',
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Parks' }]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Parks"
          titleTop="Central Oregon"
          titleBottom="parks"
          lead={`${total} notable parks from Bend to Prineville, including the state parks at Smith Rock, Tumalo, and Lake Billy Chinook. Pick a park to see its boundary on a map, the active homes nearby, and what is there.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.parks}
        />

        {cities.length === 0 ? (
          <section className="section about" id="parks" aria-label="Parks">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Parks</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The park registry is being updated. Browse{' '}
                <a className="parks-inline-link" href="/cities">
                  Central Oregon cities
                </a>{' '}
                or{' '}
                <a className="parks-inline-link" href="/search">
                  search homes
                </a>{' '}
                in the meantime.
              </p>
            </div>
          </section>
        ) : (
          cities.map((group) => (
            <section
              key={group.city}
              className="section about"
              id={`parks-${group.city.toLowerCase().replace(/\s+/g, '-')}`}
              aria-label={`Parks in ${group.city}`}
            >
              <div className="wrap">
                <div className="sec-head">
                  <span className="sec-index">Parks in</span>
                  <h2 className="sec-title display">{group.city}</h2>
                </div>

                <ul className="parks-grid">
                  {group.parks.map((park) => (
                    <li key={park.slug}>
                      <a className="parks-card" href={`/parks/${park.slug}`}>
                        <span className="parks-card-name display">{park.name}</span>
                        <span className="parks-card-meta">
                          <span className="parks-card-type mono-num">
                            {TYPE_LABEL[park.type]}
                          </span>
                          {typeof park.acres === 'number' ? (
                            <span className="parks-card-acres mono-num">
                              {park.acres.toLocaleString()} acres
                            </span>
                          ) : null}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
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
 * Route-scoped KB styling for the parks-by-city sections (cards + city groups).
 * Scoped under `.kb-root` so it cannot leak into the shadcn site, and kept here
 * (not in the shared kb.css, which this group must not touch). Hard navy edges,
 * Amboqia card titles, mono labels — the brutalist register. Motion is CSS-only
 * (border + lift on hover) so it is safe under prefers-reduced-motion.
 */
function ParksIndexStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
.kb-root .about .parks-inline-link{color:var(--navy);font-weight:600;border-bottom:1px solid var(--navy-12);transition:border-color .15s ease;}
.kb-root .about .parks-inline-link:hover,.kb-root .about .parks-inline-link:focus-visible{border-color:var(--navy);outline:none;}
.kb-root .parks-grid{list-style:none;display:grid;grid-template-columns:1fr;gap:0;margin-top:clamp(26px,3.5vw,42px);border-top:1px solid var(--navy-12);border-left:1px solid var(--navy-12);}
@media(min-width:640px){.kb-root .parks-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1040px){.kb-root .parks-grid{grid-template-columns:repeat(3,1fr);}}
.kb-root .parks-card{display:flex;flex-direction:column;gap:11px;height:100%;padding:22px 22px 24px;border-right:1px solid var(--navy-12);border-bottom:1px solid var(--navy-12);background:var(--cream);transition:background .18s ease,color .18s ease,box-shadow .18s ease;}
@media(hover:hover){.kb-root .parks-card:hover{background:var(--navy);color:var(--cream);box-shadow:var(--shadow-md,0 6px 22px rgba(16,39,66,.16));}}
.kb-root .parks-card:focus-visible{outline:3px solid var(--navy);outline-offset:-3px;}
.kb-root .parks-card-name{font-size:clamp(1.2rem,2.5vw,1.5rem);line-height:1.02;}
.kb-root .parks-card-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-top:auto;font-size:.78rem;font-weight:600;letter-spacing:.02em;}
.kb-root .parks-card-type{padding:3px 9px;border:1px solid var(--navy);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;}
.kb-root .parks-card:hover .parks-card-type{border-color:var(--cream-40);color:var(--cream);}
.kb-root .parks-card-acres{color:var(--navy-70);margin-left:auto;}
.kb-root .parks-card:hover .parks-card-acres{color:var(--cream-70);}
`,
      }}
    />
  )
}
