// @no-parity — content-engine route, replicates the /central-oregon/events KB
// register in code (docs/CONTENT_ENGINE_SPEC.md §11a), not a Wave-3 mockup.
/**
 * /central-oregon/golf — Central Oregon golf hub, KB design.
 *
 * Central Oregon is a golf destination. This lists every public, resort, and
 * private course, grouped playable-first, each linking to a detail page that
 * pairs the course with the live homes for sale nearby (the moat). Course facts
 * are verified + cited (CLAUDE.md §0). Data ONLY through @/lib/data (Gate G8).
 */

import type { Metadata } from 'next'
import { getGolfForIndex, getGolfCount } from '@/lib/data'
import { GOLF_ACCESS_LABEL, type CoGolfCourse } from '@/data/co-golf'
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
    title: 'Central Oregon Golf Courses',
    description:
      'Every golf course in Central Oregon, from public tracks like Juniper and Crooked River Ranch to the resort courses at Eagle Crest, Sunriver, and Black Butte Ranch. Each course pairs with the homes for sale nearby, from Ryan Realty.',
    path: '/central-oregon/golf',
  })
}

function CourseCard({ course }: { course: CoGolfCourse }) {
  return (
    <li>
      <a className="ev-card" href={`/central-oregon/golf/${course.slug}`}>
        <span className="ev-card-cat mono-num">
          {GOLF_ACCESS_LABEL[course.access]} · {course.holes} holes
        </span>
        <span className="ev-card-name display">{course.name}</span>
        <span className="ev-card-meta">
          <span className="ev-card-where">{course.city}</span>
        </span>
      </a>
    </li>
  )
}

export default function GolfIndexPage() {
  const { playable, private: privateCourses } = getGolfForIndex()
  const total = getGolfCount()

  const listItems = [...playable, ...privateCourses].map((c) => ({
    name: c.name,
    url: `/central-oregon/golf/${c.slug}`,
  }))

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Golf', url: '/central-oregon/golf' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Golf Courses',
      description:
        'Public, resort, and private golf courses across Central Oregon, each with the homes for sale nearby.',
      url: '/central-oregon/golf',
    },
    { type: 'itemList', name: 'Central Oregon golf courses', items: listItems },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="golf" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Golf' }]} />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Golf"
          titleTop="Golf"
          titleBottom="Central Oregon"
          lead={`${total} golf courses across Central Oregon, from city-owned public tracks to the resort courses that anchor Eagle Crest, Sunriver, Tetherow, and Black Butte Ranch. Pick a course to see what it is, where it plays, and the homes for sale nearby.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.golf}
          statless
        />

        {playable.length > 0 ? (
          <section className="section about" id="playable" aria-label="Public and resort golf courses">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Play here</span>
                <h2 className="sec-title display">Public & resort courses</h2>
              </div>
              <ul className="ev-grid">
                {playable.map((c) => (
                  <CourseCard key={c.slug} course={c} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {privateCourses.length > 0 ? (
          <section className="section about" id="private" aria-label="Private golf clubs">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Members & guests</span>
                <h2 className="sec-title display">Private clubs</h2>
              </div>
              <ul className="ev-grid">
                {privateCourses.map((c) => (
                  <CourseCard key={c.slug} course={c} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {total === 0 ? (
          <section className="section about" id="golf" aria-label="Golf">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Golf</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The golf guide is being updated. Browse{' '}
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
