// @no-parity — internal admin surface, no public mockup contract
// Content (P9 roll:remaining-families, IA lock 2026-08-05): curate what we
// publish — one content home over blog, guides, help, media, site pages,
// newsletter drafting, and the deliverable library. Rare-use destination
// (site-content-ops KEEP-thin): a definition-first hub; each door opens the
// existing machinery. Listings + Geography moved to Oversight (data-curate
// fold) — they are data curation, not publishing.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const DOORS: Array<{ name: string; href: string; what: string }> = [
  { name: 'Blog', href: '/admin/blog', what: 'SEO posts — draft, publish, retire.' },
  { name: 'Guides', href: '/admin/guides', what: 'Evergreen buyer/seller guides.' },
  { name: 'Newsletters', href: '/admin/newsletters', what: 'Draft and schedule the newsletter.' },
  { name: 'Media library', href: '/admin/media', what: 'Photos, banners, stock — every asset.' },
  { name: 'Content library', href: '/admin/content-library', what: 'Finished deliverables, reusable.' },
  { name: 'Site pages', href: '/admin/site-pages', what: 'Static page copy the site serves.' },
  { name: 'Help center', href: '/admin/help', what: 'Internal how-tos.' },
  { name: 'Ad links', href: '/admin/broker-links', what: 'Attributed short links for campaigns.' },
  { name: 'Email campaigns', href: '/admin/email/campaigns', what: 'One-off email sends and their stats.' },
]

export default async function ContentHomePage() {
  await requireAdminPage('content.view')

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 'var(--a-text-xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>Content</h1>
      <div style={{ margin: '8px 0 20px' }}>
        <VerdictLine tone="ok">
          <b>One home for everything we publish.</b> {DOORS.length} doors, each owning its lane.
        </VerdictLine>
      </div>

      <h2 className="av2-lane-head">Publish</h2>
      <ul className="av2-quietlist">
        {DOORS.map((d) => (
          <li key={d.href} className="av2-quiet">
            <Link href={d.href} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 160 }}>
              {d.name}
            </Link>
            <span style={{ color: 'var(--a-text-2)' }}>{d.what}</span>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Listing data and geography copy are curation, not publishing — they live under{' '}
        <Link href="/admin/oversight" style={{ color: 'var(--a-accent)' }}>
          Oversight
        </Link>
        's data tools.
      </p>
    </main>
  )
}
