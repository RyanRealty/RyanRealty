// @no-parity — explore surface (builder detail)
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  getActiveBuilders,
  resolveBuilderNameFromSlug,
} from '@/lib/data/listings/getActiveBuilders'
import { getListingsByBuilder } from '@/lib/data/listings/getListingsByBuilder'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import '@/components/site/kb/kb.css'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const builders = await getActiveBuilders().catch(() => [])
  return builders.slice(0, 40).map((b) => ({ slug: b.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const name = await resolveBuilderNameFromSlug(slug)
  if (!name) {
    return pageMetadata({
      title: 'Builder',
      description: 'Builder inventory for Central Oregon new construction.',
      path: `/builders/${slug}`,
      noindex: true,
    })
  }
  return pageMetadata({
    title: `${name} Homes for Sale | Central Oregon`,
    description: `Active single-family homes by ${name} in Central Oregon. Live MLS inventory.`,
    path: `/builders/${slug}`,
  })
}

export default async function BuilderDetailPage({ params }: Props) {
  const { slug } = await params
  const name = await withTimeoutFallback(resolveBuilderNameFromSlug(slug), null, 4000, 'builder:name')
  if (!name) notFound()

  const tiles = await withTimeoutFallback(
    getListingsByBuilder({ builderName: name, limit: 14 }),
    [],
    5000,
    'builder:tiles',
  )
  const featured = await withTimeoutFallback(resolveFeaturedItems(tiles, 14), [], 3000, 'builder:feat')

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="builder" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Builders', url: '/builders' },
              { name, url: `/builders/${slug}` },
            ],
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Builders', href: '/builders' },
          { label: name },
        ]}
      />
      <SmoothScrollProvider>
        <section className="section">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Builder</span>
              <h1 className="sec-title display">{name}</h1>
            </div>
            <p className="mt-3 max-w-prose text-sm" style={{ color: 'var(--navy-70)' }}>
              Active single-family listings that carry this builder name on the
              MLS. Names can vary in spelling across feeds.
            </p>
            <p className="mt-4">
              <Link href="/builders" className="underline text-sm" style={{ color: 'var(--navy)' }}>
                All builders
              </Link>
            </p>
          </div>
        </section>
        {featured.length > 0 ? (
          <KbFeatured
            items={featured}
            eyebrow={`${name} · For sale`}
            viewAllHref="/search"
            viewAllLabel="Search all homes"
            totalCount={tiles.length || null}
          />
        ) : (
          <section className="section">
            <div className="wrap">
              <p style={{ color: 'var(--navy-70)' }}>
                No active listings under this exact builder name right now.
              </p>
            </div>
          </section>
        )}
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
