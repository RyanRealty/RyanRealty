import Link from 'next/link'

/**
 * Site v2 CTA duo — 2 conversion cards (buyer listing alerts + seller home value)
 * on a muted surface. Mirrors design_system/ryan-realty/ui_kits/website/index.html §cta-duo.
 */

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export default function CtaDuo() {
  return (
    <section className="py-14 bg-muted border-t border-border">
      <div className="mx-auto max-w-7xl px-6 grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Buyer alerts */}
        <div className="bg-card border border-border rounded-[14px] p-7 shadow-sm">
          <div className="w-11 h-11 rounded-[10px] bg-primary text-white flex items-center justify-center">
            <BellIcon />
          </div>
          <h3 className="mt-3.5 mb-1.5 text-xl font-bold tracking-[-0.01em] text-foreground">
            Never miss a new listing
          </h3>
          <p className="text-sm leading-[1.55] text-muted-foreground m-0 mb-4">
            Save a search and get instant alerts when matching homes hit the market.
            Set your criteria once and we handle the rest.
          </p>
          <div className="flex gap-2.5 flex-wrap">
            <Link
              href="/lp/buyer-listing-alerts"
              className="inline-flex items-center rounded-[10px] bg-primary text-white px-[18px] py-[9px] text-sm font-semibold hover:bg-primary/85 transition active:translate-y-px"
            >
              Set up alerts
            </Link>
            <Link
              href="/homes-for-sale"
              className="inline-flex items-center rounded-[10px] bg-card text-foreground border border-border px-[18px] py-[9px] text-sm font-semibold hover:bg-muted transition active:translate-y-px"
            >
              Browse listings
            </Link>
          </div>
        </div>

        {/* Seller valuation */}
        <div className="bg-card border border-border rounded-[14px] p-7 shadow-sm">
          <div className="w-11 h-11 rounded-[10px] bg-primary text-white flex items-center justify-center">
            <PinIcon />
          </div>
          <h3 className="mt-3.5 mb-1.5 text-xl font-bold tracking-[-0.01em] text-foreground">
            Thinking about selling?
          </h3>
          <p className="text-sm leading-[1.55] text-muted-foreground m-0 mb-4">
            Get a free home valuation from a local broker who knows your neighborhood
            — not an automated estimate from a national site.
          </p>
          <div className="flex gap-2.5 flex-wrap">
            <Link
              href="/lp/seller-home-value"
              className="inline-flex items-center rounded-[10px] bg-primary text-white px-[18px] py-[9px] text-sm font-semibold hover:bg-primary/85 transition active:translate-y-px"
            >
              Get a valuation
            </Link>
            <Link
              href="/team"
              className="inline-flex items-center rounded-[10px] bg-card text-foreground border border-border px-[18px] py-[9px] text-sm font-semibold hover:bg-muted transition active:translate-y-px"
            >
              Meet the team
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
