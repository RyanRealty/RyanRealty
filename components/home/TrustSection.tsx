import Link from 'next/link'
import Image from 'next/image'

export default function TrustSection() {
  return (
    <section className="w-full bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="trust-section-heading">
      <div className="w-full">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            <Image
              src="/images/team.png"
              alt="Ryan Realty team"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div>
            <h2 id="trust-section-heading" className="text-2xl font-bold tracking-tight text-primary">
              Local Expertise You Can Trust
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ryan Realty brings deep Central Oregon market knowledge—from Bend and Redmond to Sisters and Sunriver.
              We help buyers and sellers navigate one of the most sought-after regions in the West.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-primary">15+</p>
                <p className="text-sm text-muted-foreground">Years Experience</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">500+</p>
                <p className="text-sm text-muted-foreground">Homes Sold</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">4.9</p>
                <p className="text-sm text-muted-foreground">5-Star Reviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">20+</p>
                <p className="text-sm text-muted-foreground">Communities Served</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-semibold text-accent-foreground hover:bg-accent/90"
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
