import Link from 'next/link'

/**
 * B5 — same listing_alerts product as free site capture (city/search).
 * Visual thesis (E7): split band — product honesty left, hard path CTAs right.
 * Design tokens only (no hex) so this file stays off the LP ignore list.
 */
export function SiteCaptureAlignment() {
  return (
    <section className="border-b border-border bg-muted/40" aria-label="Same product on the open site">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-12 md:items-center md:gap-10">
        <div className="md:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Same alerts, free on the site
          </p>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground md:text-lg">
            This form writes the same free listing alerts product used across the open site. No ad
            required. Enroll anytime from search or a city page.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:col-span-5 md:flex-col md:items-stretch lg:flex-row">
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center border-2 border-primary bg-primary px-5 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:opacity-90"
          >
            Open search
          </Link>
          <Link
            href="/cities/bend"
            className="inline-flex min-h-11 items-center justify-center border-2 border-primary bg-transparent px-5 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-primary transition hover:bg-primary/5"
          >
            Bend homes
          </Link>
        </div>
      </div>
    </section>
  )
}
