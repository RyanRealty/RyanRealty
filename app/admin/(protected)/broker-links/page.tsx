// @no-parity — internal broker tool (per-broker ad-link generator)
//
// Ad links — P11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: requireAdminPage('content.marketing'), siteUrl() and
// its NEXT_PUBLIC_SITE_URL fallback + trailing-slash strip, the BROKERS and LPS
// tables, the `${base}/lp/${lp.slug}?agent=${b.slug}` URL shape, the
// assigned_broker lead-form instructions, and the CopyLinkButton mount.
//
// Shape changed, data did not: the shadcn Cards became the family's grid, the
// <h1> title chrome is gone (the nav names the page), the per-broker <h2>s
// became SectionHeads, and the lead sentence became a verdict that counts the
// links actually rendered.
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { ReportGrid, SectionHead, VerdictLine, type ReportColumn } from '@/components/admin/v2'
import { CopyLinkButton } from './CopyLinkButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Ad links' }

const LPS: { slug: string; label: string }[] = [
  { slug: 'seller-home-value', label: 'Seller — Home value' },
  { slug: 'sell-your-home', label: 'Seller — List now' },
  { slug: 'fsbo', label: 'FSBO backup' },
  { slug: 'expired-listing', label: 'Expired listing' },
  { slug: 'buyer-listing-alerts', label: 'Buyer — Listing alerts' },
]

const COLUMNS: ReportColumn[] = [
  { key: 'lp', label: 'Landing page' },
  { key: 'url', label: 'Link' },
  { key: 'copy', label: 'Copy' },
]

const code = {
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-xs)',
  background: 'var(--a-inset)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 4px',
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
}

export default async function BrokerLinksPage() {
  await requireAdminPage('content.marketing')
  const access = await getCrmAccess()
  const scope = access ? scopeBroker(access) : '__unmapped__'
  const roster = (await getCrmBrokers()).filter((b) => b.crmActive)
  const brokers = scope ? roster.filter((b) => b.slug === scope) : roster
  const base = siteUrl()

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>
            {brokers.length * LPS.length} links. {LPS.length} landing pages
            {scope ? ` for ${scope}` : ` for each of the ${brokers.length} brokers`}.
          </b>{' '}
          A lead captured on your link is assigned to you in the CRM.
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
        Same landing page, same ad — the <code style={code}>?agent=</code> tag does the routing. Run
        the exact same creative as everyone else; just use your own link.
      </p>

      {brokers.map((b) => (
        <div key={b.slug}>
          <SectionHead>{b.name}</SectionHead>
          <ReportGrid
            label={`Ad links for ${b.name}`}
            columns={COLUMNS}
            template="minmax(150px, 1fr) minmax(260px, 2.2fr) auto"
            minWidth={560}
            rows={LPS.map((lp) => {
              const url = `${base}/lp/${lp.slug}?agent=${b.slug}`
              return {
                key: `${b.slug}-${lp.slug}`,
                cells: [
                  lp.label,
                  <span key="u" style={{ overflowWrap: 'anywhere', color: 'var(--a-text-2)' }}>
                    {url}
                  </span>,
                  <CopyLinkButton key="c" url={url} />,
                ],
              }
            })}
            empty="No landing pages are configured."
          />
        </div>
      ))}

      <SectionHead>Facebook lead-form ads</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
        These links only work for ads that send people to the website. A Facebook{' '}
        <em>lead-form</em> ad keeps the form on Facebook, so the link tag never gets read. For those,
        add a hidden field named <code style={code}>assigned_broker</code> set to your first name (
        <code style={code}>matt</code>, <code style={code}>rebecca</code>, or{' '}
        <code style={code}>paul</code>) on the lead form — the lead webhook routes it to you the same
        way.
      </p>
    </div>
  )
}
