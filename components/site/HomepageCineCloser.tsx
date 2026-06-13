/**
 * HomepageCineCloser — full-bleed Smith Rock finale (owned, geo-verified
 * photo) with the seller path and the direct line. One Amboqia moment,
 * two actions, nothing else.
 */

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DisplayHeading } from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'
import HomepageCineParallax from './HomepageCineParallax.client'

export default function HomepageCineCloser() {
  return (
    <section className="cine-closer" aria-label="Sell with Ryan Realty">
      <HomepageCineParallax speed={0.08}>
        <Image
          src="/images/homepage/smith-rock-terrebonne.jpg"
          alt="Smith Rock rising above the Crooked River near Terrebonne, Oregon"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </HomepageCineParallax>
      <div className="cine-closer-scrim" aria-hidden="true" />
      <div className="cine-closer-content">
        <DisplayHeading as="h2" className="cine-closer-h2">
          Selling? See what we see.
        </DisplayHeading>
        <p className="cine-closer-sub">
          The same live data behind this page, read against your home by a principal broker.
        </p>
        <div className="cine-closer-actions">
          <Button asChild className="cine-btn-primary">
            <Link href="/lp/seller-home-value">Get the reading on your home</Link>
          </Button>
          <a className="cine-btn-ghost" href={`tel:${CONTACT.phoneDirectTel}`}>
            {CONTACT.phoneDirect}
          </a>
        </div>
      </div>
    </section>
  )
}
