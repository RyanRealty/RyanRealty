import type { Metadata } from 'next'

import { getRegionPulse } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import type { KbTownItem, KbCommunityItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

/**
 * KB homepage — PREVIEW route. The kinetic-brutalist homepage built for real,
 * section by section, before it promotes to app/page.tsx. noindex so it never
 * competes with the live homepage in search. Live data via the DAL (§0).
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'KB Homepage (preview)',
  robots: { index: false, follow: false },
}

// The six service towns, in the locked prototype order, with curated photography.
const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/caldera-springs.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

// Marquee communities, curated photography. Live count joins by subdivision
// name (slug formats vary in the MV); the real slug drives the link.
const COMM_FEATURED = [
  { match: 'tetherow', town: 'Bend', img: '/images/kb/tetherow-golf-aerial.jpg' },
  { match: 'caldera', town: 'Sunriver', img: '/images/kb/caldera-springs.jpg' },
  { match: 'broken top', town: 'Bend', img: '/images/kb/broken-top.jpg' },
  { match: 'crossing', town: 'Bend', img: '/images/kb/northwest-crossing.jpg' },
]

export default async function KbHomePreview() {
  const [pulse, cities, communities] = await Promise.all([
    getRegionPulse().catch(() => null),
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
  ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const towns: KbTownItem[] = TOWN_ORDER.map((slug) => {
    const c = cityBySlug.get(slug)
    if (!c) return null
    return {
      name: c.name,
      activeCount: c.activeCount,
      medianPrice: c.medianPrice,
      href: `/cities/${slug}`,
      img: TOWN_IMG[slug],
    }
  }).filter((t): t is KbTownItem => t !== null)

  const communityItems: KbCommunityItem[] = COMM_FEATURED.map((f) => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return null
    return {
      name: c.subdivision,
      activeCount: c.activeCount,
      town: f.town,
      href: `/communities/${c.slug}`,
      img: f.img,
    }
  }).filter((x): x is KbCommunityItem => x !== null)

  return (
    <main className="kb-root">
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
        />
        <KbExploreTowns towns={towns} />
        <KbCommunities communities={communityItems} />
        <KbTeam />
        <KbFooter towns={towns} />
      </SmoothScrollProvider>
    </main>
  )
}
