import Link from 'next/link'

/** B5 — same listing_alerts product as free site capture (city/search). */
export function SiteCaptureAlignment() {
  return (
    <section className="border-b-[3px] border-[#102742] bg-[#faf8f4]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#102742]/70">
          Same alerts, free on the site
        </p>
        <p className="mt-3 text-base leading-relaxed text-[#102742]/85">
          This form writes the same free listing alerts product used across the open site. No ad
          required — enroll anytime from{' '}
          <Link
            href="/search"
            className="font-semibold text-[#102742] underline underline-offset-4 hover:no-underline"
          >
            search
          </Link>{' '}
          or a city page such as{' '}
          <Link
            href="/cities/bend"
            className="font-semibold text-[#102742] underline underline-offset-4 hover:no-underline"
          >
            Bend homes
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
