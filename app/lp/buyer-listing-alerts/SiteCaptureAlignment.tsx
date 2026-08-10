import Link from 'next/link'

/** B5 — same listing_alerts product as free site capture (city/search). */
export function SiteCaptureAlignment() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Same alerts, free on the site
        </p>
        <p className="mt-3 text-base leading-relaxed text-foreground">
          This form writes the same free listing alerts product used across the open site. No ad
          required — enroll anytime from{' '}
          <Link href="/search" className="font-semibold text-primary underline underline-offset-4 hover:no-underline">
            search
          </Link>{' '}
          or a city page such as{' '}
          <Link href="/cities/bend" className="font-semibold text-primary underline underline-offset-4 hover:no-underline">
            Bend homes
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
