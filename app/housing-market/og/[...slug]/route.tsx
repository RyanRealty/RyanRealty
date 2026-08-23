import { ImageResponse } from 'next/og'
import { getCachedStats, getLiveMarketPulse } from '@/app/actions/market-stats'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'

// Node: getLiveMarketPulse → getMarketPulse uses unstable_cache (not Edge-safe).
export const runtime = 'nodejs'

function unslug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function GET(_: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params
  const cityName = unslug(slug?.[0] ?? 'Central Oregon')
  const communityName = slug?.[1] ? unslug(slug[1]) : null
  const geoName = communityName ?? cityName
  const geoType = communityName ? 'subdivision' : 'city'
  const geoSlug = communityName
    ? (slug?.[1] ?? '')
    : canonicalCityCacheSlug(slug?.[0] ?? '')

  const [stats, pulse] = await Promise.all([
    getCachedStats({ geoType, geoSlug, periodType: 'monthly' }),
    getLiveMarketPulse({ geoType, geoSlug }),
  ])

  const medianSale = stats?.median_sale_price ? `$${Math.round(Number(stats.median_sale_price)).toLocaleString()}` : 'N/A'
  const dom = stats?.median_dom != null ? `${Math.round(Number(stats.median_dom))} days` : 'N/A'
  const health = pulse?.market_health_label ?? 'N/A'
  const active = pulse?.active_count != null ? Math.round(Number(pulse.active_count)).toLocaleString() : 'N/A'

  const bars = [
    Number(stats?.market_health_score ?? 0) / 20,
    Number(pulse?.active_count ?? 0) / 50,
    Number(stats?.sold_count ?? 0) / 20,
    Number(stats?.median_dom ?? 0) / 10,
  ].map((value) => Math.max(0.08, Math.min(1, Number.isFinite(value) ? value : 0.08)))

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(120deg, #102742 0%, #1f4f80 60%, #2f6ca3 100%)',
          color: '#fff',
          padding: 44,
          fontFamily: 'Arial',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 24, opacity: 0.85 }}>Ryan Realty Market Snapshot</span>
            <span style={{ marginTop: 6, fontSize: 54, fontWeight: 700, lineHeight: 1.1 }}>{geoName}</span>
          </div>
          <div style={{ fontSize: 20, opacity: 0.85 }}>
            Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {[
            `Median sale price ${medianSale}`,
            `Median DOM ${dom}`,
            health === 'N/A' ? 'Market health N/A' : health,
            `Active inventory ${active}`,
          ].map((text) => (
            <div
              key={text}
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 14,
                padding: '16px 18px',
                minWidth: 250,
              }}
            >
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.78)' }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110 }}>
          {bars.map((bar, index) => (
            <div
              key={index}
              style={{
                width: 70,
                height: `${Math.round(bar * 100)}%`,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.85)',
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )

  return image
}
