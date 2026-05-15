/**
 * /marketing/request — the page brokers land on from the link in every
 * marketing@ reply signature. Pick what you want, fill in a couple of
 * fields, hit "Build my email," and your email client opens with the
 * request pre-written and addressed to marketing@ryan-realty.com.
 *
 * No auth gate (linked from email). No backend writes. The marketing
 * inbox itself enforces the allowlist; this page is purely a mailto:
 * builder so brokers do not have to remember what they can ask for.
 *
 * To update the menu of deliverables: edit ./deliverables.ts.
 */
import type { Metadata } from 'next'
import RequestBuilder from './RequestBuilder'

export const metadata: Metadata = {
  title: 'Marketing request | Ryan Realty',
  description:
    'Here is what the Ryan Realty marketing team can build for you — listing kits, market reports, social posts, ads, blog posts, and more. Pick what you need and we will draft it.',
  robots: { index: false, follow: false },
}

export default function MarketingRequestPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Ryan Realty marketing
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Here&rsquo;s what we can build for you.
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Pick anything you need. The team gets the request, drafts it, and replies on the email
            thread with the draft for your review. Most items land in your inbox within a day; market
            reports and full listing kits take a little longer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <RequestBuilder />
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">
          <p>
            Need something that is not on this list? Email{' '}
            <a href="mailto:marketing@ryan-realty.com" className="text-primary underline-offset-4 hover:underline">
              marketing@ryan-realty.com
            </a>{' '}
            directly and describe what you have in mind. The team reviews every request.
          </p>
        </div>
      </section>
    </main>
  )
}
