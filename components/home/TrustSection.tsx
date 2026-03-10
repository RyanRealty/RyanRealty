'use client'

import Link from 'next/link'
import Image from 'next/image'

const PLACEHOLDER_TEAM =
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80'

export default function TrustSection() {
  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="trust-section-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--gray-bg)]">
            <Image
              src={PLACEHOLDER_TEAM}
              alt="Ryan Realty team"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div>
            <h2 id="trust-section-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
              Local Expertise You Can Trust
            </h2>
            <p className="mt-4 text-[var(--text-secondary)]">
              Ryan Realty brings deep Central Oregon market knowledge—from Bend and Redmond to Sisters and Sunriver.
              We help buyers and sellers navigate one of the most sought-after regions in the West.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-[var(--brand-navy)]">15+</p>
                <p className="text-sm text-[var(--text-secondary)]">Years Experience</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--brand-navy)]">500+</p>
                <p className="text-sm text-[var(--text-secondary)]">Homes Sold</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--brand-navy)]">4.9</p>
                <p className="text-sm text-[var(--text-secondary)]">5-Star Reviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--brand-navy)]">20+</p>
                <p className="text-sm text-[var(--text-secondary)]">Communities Served</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
              >
                Meet the Team
              </Link>
              <img
                src="https://www.hud.gov/sites/dfiles/OEO/images/EHO-Logo-White-Bg.png"
                alt="Equal Housing Opportunity"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
