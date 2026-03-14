import type { Metadata } from 'next'
import Link from 'next/link'
import { classifyMarketCondition } from '@/lib/market-condition'
import { createClient } from '@supabase/supabase-js'
import { getPageContent } from '@/app/actions/site-pages'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import { sanitizeHtml } from '@/lib/sanitize'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export const metadata: Metadata = {
  title: 'Sell Your Home | Ryan Realty',
  description: 'Thinking of selling? Get a free home value estimate and learn how Ryan Realty markets and sells Central Oregon homes.',
  alternates: { canonical: `${siteUrl}/sell` },
  openGraph: { title: 'Sell Your Home | Ryan Realty', url: `${siteUrl}/sell`, type: 'website' },
}

function defaultSellBody(): string {
  return `<p>Get a data-driven estimate of your home's value and a plan that gets it sold.</p>
<ul>
<li><strong>Marketing plan</strong> — Professional photography, listing placement, and targeted outreach.</li>
<li><strong>Data-driven pricing</strong> — We use local comps and market trends to price for a strong offer.</li>
<li><strong>Local expertise</strong> — Central Oregon is our backyard. We know the neighborhoods and buyers.</li>
</ul>
<p><a href="/contact?inquiry=Selling">Contact us</a> for a free consultation.</p>`
}

export default async function SellPage() {
  const [pageContent, supabase, session, fubPersonId] = await Promise.all([
    getPageContent('sell'),
    Promise.resolve(getSupabase()),
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const pageUrl = `${siteUrl}/sell`
  const pageTitle = 'Sell Your Home | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const title = pageContent?.title?.trim() || 'Thinking of Selling?'
  const bodyHtml = pageContent?.body_html?.trim() || defaultSellBody()

  let conditionLabel = 'Balanced Market'
  if (supabase) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const periodStart = startOfMonth.toISOString().slice(0, 10)
    const periodEnd = new Date().toISOString().slice(0, 10)
    const { data: row } = await supabase
      .from('reporting_cache')
      .select('metrics')
      .eq('geo_type', 'city')
      .eq('geo_name', 'Bend')
      .eq('period_type', 'monthly')
      .eq('period_start', periodStart)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const metrics = (row?.metrics as Record<string, unknown>) ?? {}
    const result = classifyMarketCondition({
      monthsOfInventory: metrics.inventory_months != null ? Number(metrics.inventory_months) : null,
      avgDom: metrics.median_dom != null ? Number(metrics.median_dom) : null,
      listToSoldRatio: null,
    })
    conditionLabel = result.label
  }

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title={title}
        subtitle="Data-driven pricing, professional marketing, and a team that knows Central Oregon. Get a free valuation and a clear plan to sell."
        imageUrl={CONTENT_HERO_IMAGES.sell}
        ctas={[
          { label: 'Get a Home Valuation', href: '/home-valuation', primary: true },
          { label: 'Contact Us to Sell', href: '/contact?inquiry=Selling', primary: false },
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <section className="prose prose-primary max-w-none" aria-labelledby="sell-content-heading">
        <h2 id="sell-content-heading" className="sr-only">Sell with us</h2>
        <div
          className="text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
        />
      </section>

      <section className="mt-12 rounded-lg border border-border bg-muted p-6" aria-labelledby="market-heading">
        <h2 id="market-heading" className="text-lg font-semibold text-primary">Market reports & data</h2>
        <p className="mt-2 text-muted-foreground">
          Current Bend conditions: <span className="font-medium text-primary">{conditionLabel}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/reports"
            className="inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Weekly market reports
          </Link>
          <Link
            href="/reports/explore"
            className="inline-flex rounded-lg border border-primary/20 bg-card px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted"
          >
            Explore market data
          </Link>
          <Link href="/reports/city/Bend" className="inline-block text-sm font-medium text-accent-foreground hover:underline">
            Bend market report
          </Link>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="seller-resources-heading">
        <h2 id="seller-resources-heading" className="text-lg font-semibold text-foreground">Seller resources</h2>
        <p className="mt-1 text-muted-foreground">Tips and guides from our blog.</p>
        <Link href="/blog?category=Selling%20Tips" className="mt-3 inline-block text-primary hover:underline">
          Selling tips on the blog
        </Link>
      </section>

      <section className="mt-12 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="consult-heading">
        <h2 id="consult-heading" className="text-lg font-semibold text-foreground">Get a free consultation</h2>
        <p className="mt-1 text-muted-foreground">Tell us about your home and timeline. We&apos;ll follow up with a no-pressure conversation.</p>
        <Link
          href="/contact?inquiry=Selling"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-foreground hover:opacity-90"
        >
          Contact us
        </Link>
      </section>
      </div>
    </main>
  )
}
