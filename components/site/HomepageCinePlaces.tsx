/**
 * HomepageCinePlaces — editorial full-bleed place bands + resort strip.
 *
 * Photography rule: every band image is OWNED (Matt's drone library),
 * A-graded by vision review, and geo-VERIFIED via asset-library geo_tags —
 * no stock, no unverified place claims. Copies live at public/images/homepage/
 * (source manifest ids: aab6f55b Bend Drake Park · 7a4b02d3 Sisters downtown
 * with the Three Sisters · c5a01c8a Tetherow fairways).
 */

import Image from 'next/image'
import Link from 'next/link'
import { DisplayHeading } from '@/components/site/primitives'
import HomepageCineParallax from './HomepageCineParallax.client'

export type PlaceStatLines = {
  /** e.g. "412 active · median $737,000" — from the city market_pulse_live row. */
  bend: string | null
  sisters: string | null
}

const BANDS = [
  {
    name: 'Bend',
    line: 'The Deschutes through the middle of town, trails out the back door, and a market we track street by street.',
    href: '/cities/bend',
    linkLabel: 'Explore Bend',
    src: '/images/homepage/bend-drake-park-aerial.jpg',
    alt: 'Aerial view of the Deschutes River through Drake Park in Bend, Oregon',
  },
  {
    name: 'Sisters',
    line: 'Three peaks on the horizon and a main street that still closes for the rodeo parade.',
    href: '/cities/sisters',
    linkLabel: 'Explore Sisters',
    src: '/images/homepage/sisters-downtown-three-peaks.jpg',
    alt: 'Aerial view of downtown Sisters, Oregon with the Three Sisters peaks behind',
  },
  {
    name: 'Tetherow',
    line: 'Fairway lots, modern builds, and the closed-sale history behind every street.',
    href: '/communities/tetherow',
    linkLabel: 'Explore Tetherow',
    src: '/images/homepage/tetherow-golf-aerial.jpg',
    alt: 'Aerial view of the Tetherow golf course and homes in Bend, Oregon',
  },
] as const

const RESORTS = [
  { name: 'Tetherow', slug: 'tetherow' },
  { name: 'Caldera Springs', slug: 'caldera-springs' },
  { name: 'Sunriver', slug: 'sunriver' },
  { name: 'Black Butte Ranch', slug: 'black-butte-ranch' },
  { name: 'Brasada Ranch', slug: 'brasada-ranch' },
  { name: 'Crosswater', slug: 'crosswater' },
  { name: 'Vandevert Ranch', slug: 'vandevert-ranch' },
  { name: 'Pronghorn', slug: 'pronghorn' },
] as const

export default function HomepageCinePlaces({ statLines }: { statLines: PlaceStatLines }) {
  const statFor = (name: string): string | null =>
    name === 'Bend' ? statLines.bend : name === 'Sisters' ? statLines.sisters : null

  return (
    <>
      {BANDS.map((b) => {
        const stat = statFor(b.name)
        return (
          <section key={b.name} className="cine-band" aria-label={b.name}>
            <HomepageCineParallax>
              <Image src={b.src} alt={b.alt} fill sizes="100vw" className="object-cover" />
            </HomepageCineParallax>
            <div className="cine-band-scrim" aria-hidden="true" />
            <div className="cine-band-content">
              <DisplayHeading as="h2" className="cine-band-name">
                {b.name}
              </DisplayHeading>
              <p className="cine-band-line">{b.line}</p>
              {stat && <p className="cine-band-stat">{stat}</p>}
              <Link href={b.href} className="cine-band-link">
                {b.linkLabel} →
              </Link>
            </div>
          </section>
        )
      })}

      <section className="cine-resorts" aria-label="Resort communities">
        <div className="cine-resorts-wrap">
          <p className="cine-eyebrow">The resort communities</p>
          <div className="cine-resorts-list">
            {RESORTS.map((r, i) => (
              <span key={r.slug}>
                <Link href={`/communities/${r.slug}`}>{r.name}</Link>
                {i < RESORTS.length - 1 && <span className="cine-sep"> · </span>}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
