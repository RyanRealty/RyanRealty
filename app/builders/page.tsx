// @no-parity — explore surface (builders index)
import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getActiveBuilders } from '@/lib/data/listings/getActiveBuilders'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import '@/components/site/kb/kb.css'

export const revalidate = 300

export const metadata: Metadata = pageMetadata({
  title: 'New Construction Builders | Central Oregon',
  description:
    'Active new-construction builders with homes for sale in Bend, Redmond, and Central Oregon. Browse by builder name.',
  path: '/builders',
})

export default async function BuildersIndexPage() {
  const builders = await withTimeoutFallback(getActiveBuilders(), [], 5000, 'builders:index')

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="builders" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Builders', url: '/builders' },
            ],
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Builders' }]}
      />
      <SmoothScrollProvider>
        <section className="section">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">New construction</span>
              <h1 className="sec-title display">Builders with homes for sale</h1>
            </div>
            <p className="mt-3 max-w-prose text-sm" style={{ color: 'var(--navy-70)' }}>
              Names come from the MLS Builder field on active single-family new
              construction. Counts are a live sample of inventory, not a lifetime
              production total.
            </p>
            {builders.length === 0 ? (
              <p className="mt-8" style={{ color: 'var(--navy-70)' }}>
                No builder names on active new construction right now. Browse{' '}
                <Link href="/search?newConstruction=1" className="underline">
                  new construction search
                </Link>
                .
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: '2rem 0 0',
                  padding: 0,
                  borderTop: '1px solid rgba(16,39,66,0.12)',
                }}
              >
                {builders.map((b) => (
                  <li
                    key={b.slug}
                    style={{ borderBottom: '1px solid rgba(16,39,66,0.12)' }}
                  >
                    <Link
                      href={`/builders/${b.slug}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        padding: '1rem 0',
                        color: 'var(--navy)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                      className="hover:opacity-80"
                    >
                      <span className="display" style={{ fontSize: '1.25rem', fontWeight: 500 }}>
                        {b.name}
                      </span>
                      <span
                        className="mono-num"
                        style={{ color: 'var(--navy-70)', fontSize: '0.9rem' }}
                      >
                        {b.sampleCount} active in sample
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
