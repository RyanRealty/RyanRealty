// @no-parity — internal broker tool (per-broker ad-link generator)
import { Card } from '@/components/ui/card'
import type { BrokerSlug } from '@/lib/agent-attribution'
import { CopyLinkButton } from './CopyLinkButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Ad links' }

const BROKERS: { slug: BrokerSlug; name: string }[] = [
  { slug: 'matt', name: 'Matt Ryan' },
  { slug: 'rebecca', name: 'Rebecca Peterson' },
  { slug: 'paul', name: 'Paul Stevenson' },
]

const LPS: { slug: string; label: string }[] = [
  { slug: 'seller-home-value', label: 'Seller — Home value' },
  { slug: 'sell-your-home', label: 'Seller — List now' },
  { slug: 'fsbo', label: 'FSBO backup' },
  { slug: 'expired-listing', label: 'Expired listing' },
  { slug: 'buyer-listing-alerts', label: 'Buyer — Listing alerts' },
]

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
}

export default function BrokerLinksPage() {
  const base = siteUrl()
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Your ad links</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Point your ad at one of these links and every lead it captures is assigned to you in the CRM.
          Same landing page, same ad — the <code className="rounded bg-muted px-1 py-0.5 text-xs">?agent=</code> tag
          does the routing. Run the exact same creative as everyone else; just use your own link.
        </p>
      </header>

      {BROKERS.map((b) => (
        <Card key={b.slug} className="p-4 sm:p-5">
          <h2 className="mb-3 text-base font-semibold text-foreground">{b.name}</h2>
          <ul className="space-y-3">
            {LPS.map((lp) => {
              const url = `${base}/lp/${lp.slug}?agent=${b.slug}`
              return (
                <li
                  key={lp.slug}
                  className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{lp.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{url}</p>
                  </div>
                  <CopyLinkButton url={url} />
                </li>
              )
            })}
          </ul>
        </Card>
      ))}

      <Card className="border-dashed p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Facebook lead-form ads</h2>
        <p className="max-w-2xl text-xs text-muted-foreground">
          These links only work for ads that send people to the website. A Facebook <em>lead-form</em> ad keeps the
          form on Facebook, so the link tag never gets read. For those, add a hidden field named{' '}
          <code className="rounded bg-muted px-1 py-0.5">assigned_broker</code> set to your first name
          (<code className="rounded bg-muted px-1 py-0.5">matt</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">rebecca</code>, or{' '}
          <code className="rounded bg-muted px-1 py-0.5">paul</code>) on the lead form — the lead webhook routes it to
          you the same way.
        </p>
      </Card>
    </div>
  )
}
