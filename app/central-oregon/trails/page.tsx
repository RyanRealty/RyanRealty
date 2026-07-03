// @no-parity — content-engine route, replicates the /central-oregon/events KB
// register in code (docs/CONTENT_ENGINE_SPEC.md §11a), not a Wave-3 mockup.
/**
 * /central-oregon/trails — Central Oregon trails hub, KB design.
 *
 * Central Oregon is a trail town. This lists the marquee hiking and mountain-bike
 * trails, grouped by use, each linking to a detail page that pairs the trailhead
 * with the live homes for sale nearby (the moat). Trail facts are verified +
 * cited (CLAUDE.md §0). Data ONLY through @/lib/data (Gate G8).
 */

import type { Metadata } from 'next'
import { getTrailsForIndex, getTrailsCount } from '@/lib/data'
import { TRAIL_USE_LABEL, type CoTrail } from '@/data/co-trails'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'
import '../events/events.css'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Hiking & Mountain Bike Trails',
    description:
      'The marquee hiking and mountain-bike trails across Central Oregon, from Pilot Butte and the Deschutes River Trail to Green Lakes, South Sister, Smith Rock, and the Phil’s network. Each trail pairs with the homes for sale nearby, from Ryan Realty.',
    path: '/central-oregon/trails',
  })
}

function TrailCard({ trail }: { trail: CoTrail }) {
  const dist =
    typeof trail.lengthMiles === 'number'
      ? `${trail.lengthMiles} mi${trail.distanceNote ? ` ${trail.distanceNote}` : ''}`
      : trail.landManager
  return (
    <li>
      <a className="ev-card" href={`/central-oregon/trails/${trail.slug}`}>
        <span className="ev-card-cat mono-num">
          {TRAIL_USE_LABEL[trail.use]} · {dist}
        </span>
        <span className="ev-card-name display">{trail.name}</span>
        <span className="ev-card-meta">
          <span className="ev-card-where">{trail.city}</span>
        </span>
      </a>
    </li>
  )
}

export default function TrailsIndexPage() {
  const { hiking, biking } = getTrailsForIndex()
  const total = getTrailsCount()

  const listItems = [...hiking, ...biking]
    .filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i)
    .map((t) => ({ name: t.name, url: `/central-oregon/trails/${t.slug}` }))

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Trails', url: '/central-oregon/trails' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Hiking & Mountain Bike Trails',
      description:
        'Hiking and mountain-bike trails across Central Oregon, each with the homes for sale nearby.',
      url: '/central-oregon/trails',
    },
    { type: 'itemList', name: 'Central Oregon trails', items: listItems },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="trails" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Trails' }]} />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Trails"
          titleTop="Trails"
          titleBottom="Central Oregon"
          lead={`${total} of the hiking and mountain-bike trails that define Central Oregon, from the butte in the middle of Bend to the alpine lakes under South Sister and the walls at Smith Rock. Pick a trail to see what it is, where the trailhead is, and the homes for sale nearby.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.trails}
          statless
        />

        {hiking.length > 0 ? (
          <section className="section about" id="hiking" aria-label="Hiking trails">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">On foot</span>
                <h2 className="sec-title display">Hiking trails</h2>
              </div>
              <ul className="ev-grid">
                {hiking.map((t) => (
                  <TrailCard key={t.slug} trail={t} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {biking.length > 0 ? (
          <section className="section about" id="biking" aria-label="Mountain bike trails">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">On two wheels</span>
                <h2 className="sec-title display">Mountain-bike trails</h2>
              </div>
              <ul className="ev-grid">
                {biking.map((t) => (
                  <TrailCard key={t.slug} trail={t} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {total === 0 ? (
          <section className="section about" id="trails" aria-label="Trails">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Trails</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The trail guide is being updated. Browse{' '}
                <a className="ev-inline-link" href="/central-oregon/events">
                  Central Oregon events
                </a>{' '}
                in the meantime.
              </p>
            </div>
          </section>
        ) : null}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
