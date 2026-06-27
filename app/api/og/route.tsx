import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { getListingTiles } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) return null
  return createClient(url, anonKey)
}

// Edge required for ImageResponse latency; disables static generation for this route.
export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'default'
  const id = searchParams.get('id') ?? searchParams.get('slug') ?? ''

  if (type === 'listing' && id) {
    const supabase = getSupabase()
    if (supabase) {
      // DAL: read tile via listingKeys filter (returns one row with full
      // address + photo URL inlined). Replaces the prior 3-query chain
      // (listings + properties + listing_photos) with a single MV lookup.
      const tiles = await getListingTiles({
        listingKeys: [id],
        status: 'all',
        limit: 1,
      })
      const tile = tiles[0]
      if (tile) {
        const address = [tile.streetNumber, tile.streetName].filter(Boolean).join(' ')
        let photoUrl: string | undefined = tile.photoUrl ?? undefined
        if (!photoUrl) {
          void supabase
          const { getHeroPhotosByListingKeys } = await import('@/lib/data')
          const heroMap = await getHeroPhotosByListingKeys([tile.listingKey])
          photoUrl = heroMap.get(tile.listingKey)
        }
        const price = tile.listPrice != null && tile.listPrice > 0 ? `$${tile.listPrice.toLocaleString()}` : ''
        const stats = [tile.beds, tile.baths, tile.sqft].filter(Boolean)
        const statsStr = stats.length ? `${tile.beds ?? '—'} bed · ${tile.baths ?? '—'} bath${tile.sqft ? ` · ${tile.sqft.toLocaleString()} sq ft` : ''}` : ''
        return new ImageResponse(
          (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                background: photoUrl ? `url(${photoUrl})` : '#102742',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(transparent 0%, rgba(0,0,0,0.85) 100%)',
                  padding: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {price && (
                  <span style={{ backgroundColor: '#d4a853', color: '#102742', padding: '12px 24px', borderRadius: 8, fontSize: 36, fontWeight: 700 }}>
                    {price}
                  </span>
                )}
                <span style={{ color: 'white', fontSize: 28 }}>{address || 'Property'}</span>
                {statsStr && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20 }}>{statsStr}</span>}
                <span style={{ position: 'absolute', bottom: 24, right: 24, color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>Ryan Realty</span>
              </div>
            </div>
          ),
          { width: 1200, height: 630 }
        )
      }
    }
  }

  if (type === 'community') {
    // Fix 7: accept ?name=...&city=... directly (no DB lookup needed) so every
    // community gets a branded OG card even without a curated static image.
    // The page's generateMetadata passes these params when no static image exists.
    const nameParam = searchParams.get('name') ?? ''
    const cityParam = searchParams.get('city') ?? ''
    if (nameParam) {
      const cityLine = cityParam ? `${cityParam}, OR` : 'Central Oregon, OR'
      return new ImageResponse(
        (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#102742', padding: 48 }}>
            <span style={{ color: '#faf8f4', fontSize: 56, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{nameParam}</span>
            <span style={{ color: '#faf8f4', fontSize: 22, marginTop: 16, opacity: 0.75 }}>{cityLine}</span>
            <span style={{ color: '#faf8f4', fontSize: 22, marginTop: 8, opacity: 0.55 }}>Homes for Sale &middot; Ryan Realty</span>
          </div>
        ),
        { width: 1200, height: 630 }
      )
    }
    // Legacy: lookup by slug via DB
    if (id) {
      const supabase = getSupabase()
      if (supabase) {
        void supabase
        const { getCommunityNameBySlugIlike } = await import('@/lib/data')
        const c = await getCommunityNameBySlugIlike(id)
        if (c?.name) {
          return new ImageResponse(
            (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#102742', padding: 48 }}>
                <span style={{ color: '#faf8f4', fontSize: 56, fontWeight: 700, textAlign: 'center' }}>{c.name}</span>
                <span style={{ color: '#faf8f4', fontSize: 24, marginTop: 16, opacity: 0.65 }}>Homes for Sale &middot; Ryan Realty</span>
              </div>
            ),
            { width: 1200, height: 630 }
          )
        }
      }
    }
  }

  if (type === 'blog' && id) {
    const supabase = getSupabase()
    if (supabase) {
      void supabase
      const { getBlogPostForOgBySlug } = await import('@/lib/data')
      const p = await getBlogPostForOgBySlug(id)
      if (p?.title) {
        // P0-4: heroes are local public/ paths now — satori needs an absolute URL.
        const heroUrl = p.hero_image_url?.startsWith('/')
          ? new URL(p.hero_image_url, request.url).toString()
          : p.hero_image_url
        return new ImageResponse(
          (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                background: heroUrl ? `url(${heroUrl})` : '#102742',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div
                style={{
                  background: heroUrl
                    ? 'linear-gradient(transparent 0%, rgba(0,0,0,0.85) 100%)'
                    : 'transparent',
                  padding: heroUrl ? 48 : 64,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: heroUrl ? 'flex-end' : 'center',
                  gap: 12,
                  flexGrow: heroUrl ? 0 : 1,
                }}
              >
                {p.category && (
                  <span style={{ color: '#d4a853', fontSize: 18, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {p.category}
                  </span>
                )}
                <span style={{ color: 'white', fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{p.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, marginTop: 8 }}>Ryan Realty | Central Oregon Real Estate</span>
              </div>
            </div>
          ),
          { width: 1200, height: 630 }
        )
      }
    }
  }

  if (type === 'broker' && id) {
    const supabase = getSupabase()
    if (supabase) {
      void supabase
      const { getBrokerForOgBySlug } = await import('@/lib/data')
      const b = await getBrokerForOgBySlug(id)
      if (b?.display_name) {
        return new ImageResponse(
          (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0eeec', padding: 48 }}>
              {b.photo_url && (
                <img src={b.photo_url} alt={b.display_name || 'Agent photo'} width={160} height={160} style={{ borderRadius: '50%', objectFit: 'cover', marginBottom: 24 }} />
              )}
              <span style={{ color: '#102742', fontSize: 42, fontWeight: 700 }}>{b.display_name}</span>
              {b.title && <span style={{ color: '#6b7280', fontSize: 22, marginTop: 8 }}>{b.title}</span>}
              <span style={{ position: 'absolute', bottom: 24, right: 24, color: '#9ca3af', fontSize: 16 }}>Ryan Realty</span>
            </div>
          ),
          { width: 1200, height: 630 }
        )
      }
    }
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#102742', padding: 48 }}>
        <span style={{ color: 'white', fontSize: 52, fontWeight: 700, textAlign: 'center' }}>Ryan Realty</span>
        <span style={{ color: '#d4a853', fontSize: 28, marginTop: 20 }}>Central Oregon Real Estate</span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
