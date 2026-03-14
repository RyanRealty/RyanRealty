import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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
      const { data: listing } = await supabase
        .from('listings')
        .select('listing_key, list_price, beds_total, baths_full, living_area, property_id')
        .eq('listing_key', id)
        .maybeSingle()
      if (listing) {
        const r = listing as { listing_key: string; list_price?: number; beds_total?: number; baths_full?: number; living_area?: number; property_id?: string }
        const { data: prop } = r.property_id
          ? await supabase.from('properties').select('unparsed_address, street_number, street_name, city').eq('id', r.property_id).maybeSingle()
          : { data: null }
        const p = prop as { unparsed_address?: string; street_number?: string; street_name?: string; city?: string } | null
        const address = p?.unparsed_address ?? [p?.street_number, p?.street_name].filter(Boolean).join(' ') ?? ''
        const { data: photo } = await supabase
          .from('listing_photos')
          .select('photo_url')
          .eq('listing_key', r.listing_key)
          .eq('is_hero', true)
          .limit(1)
          .maybeSingle()
        const photoUrl = (photo as { photo_url?: string } | null)?.photo_url
        const price = r.list_price != null && r.list_price > 0 ? `$${r.list_price.toLocaleString()}` : ''
        const stats = [r.beds_total, r.baths_full, r.living_area].filter(Boolean)
        const statsStr = stats.length ? `${r.beds_total ?? '—'} bed · ${r.baths_full ?? '—'} bath${r.living_area ? ` · ${Number(r.living_area).toLocaleString()} sq ft` : ''}` : ''
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

  if (type === 'community' && id) {
    const supabase = getSupabase()
    if (supabase) {
      const { data: comm } = await supabase.from('communities').select('name, slug').ilike('slug', id).maybeSingle()
      const c = comm as { name?: string; slug?: string } | null
      if (c?.name) {
        return new ImageResponse(
          (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#102742', padding: 48 }}>
              <span style={{ color: 'white', fontSize: 56, fontWeight: 700, textAlign: 'center' }}>{c.name}</span>
              <span style={{ color: '#d4a853', fontSize: 24, marginTop: 16 }}>Homes for Sale | Ryan Realty</span>
            </div>
          ),
          { width: 1200, height: 630 }
        )
      }
    }
  }

  if (type === 'blog' && id) {
    const supabase = getSupabase()
    if (supabase) {
      const { data: post } = await supabase.from('blog_posts').select('title, author_name').eq('slug', id).maybeSingle()
      const p = post as { title?: string; author_name?: string } | null
      if (p?.title) {
        return new ImageResponse(
          (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#102742', padding: 64 }}>
              <span style={{ color: 'white', fontSize: 48, fontWeight: 700 }}>{p.title}</span>
              {p.author_name && <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 24, marginTop: 24 }}>{p.author_name}</span>}
              <span style={{ position: 'absolute', bottom: 32, right: 32, color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>Ryan Realty</span>
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
      const { data: broker } = await supabase.from('brokers').select('display_name, title, photo_url').eq('slug', id).eq('is_active', true).maybeSingle()
      const b = broker as { display_name?: string; title?: string; photo_url?: string } | null
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
