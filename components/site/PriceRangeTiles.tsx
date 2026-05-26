import Link from 'next/link'

/**
 * Site v2 price-range tiles — 4 buyer entry tiles by price band, on a muted
 * surface. Mirrors design_system/ryan-realty/ui_kits/website/index.html §price-range.
 *
 * Per brand voice rule: no fabricated counts. Subtitles describe the band, not
 * a number we can't verify in real time.
 */
const RANGES = [
  {
    href: '/search?maxPrice=600000',
    range: 'Under $600k',
    sub: 'Entry-level + condos',
  },
  {
    href: '/search?minPrice=600000&maxPrice=900000',
    range: '$600k – $900k',
    sub: 'Move-up homes',
  },
  {
    href: '/search?minPrice=900000&maxPrice=1500000',
    range: '$900k – $1.5M',
    sub: 'Premium properties',
  },
  {
    href: '/search?minPrice=1500000',
    range: '$1.5M and up',
    sub: 'Luxury and estate homes',
  },
] as const

export default function PriceRangeTiles() {
  return (
    <section className="py-14 bg-muted border-y border-border">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-6">
          <div className="rr-eyebrow">Inventory</div>
          <h2 className="mt-1.5 text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-bold tracking-[-0.01em] text-foreground">
            Browse by price range
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Quickly find homes within your budget.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {RANGES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group bg-card border border-border rounded-[14px] p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xl font-bold tracking-[-0.01em] text-foreground">
                    {tile.range}
                  </div>
                  <div className="text-[13px] text-muted-foreground mt-1">{tile.sub}</div>
                </div>
                <span
                  aria-hidden
                  className="text-muted-foreground group-hover:text-primary transition translate-y-0.5"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
