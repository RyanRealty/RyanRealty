import { ImageResponse } from 'next/og'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

// Node: leftover overlays use unstable_cache (not Edge-safe).
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
  const leftoverType = communityName ? 'neighborhood' : 'city'
  const leftoverSlug = communityName
    ? cityDetachedSlug(slug?.[1] ?? '')
    : cityDetachedSlug(canonicalCityCacheSlug(slug?.[0] ?? ''))
  const overlays = leftoverSlug
    ? await getDetachedOverlays([{ geoType: leftoverType, geoSlug: leftoverSlug }])
    : new Map()
  const layers = leftoverSlug ? overlays.get(`${leftoverType}:${leftoverSlug}`) : undefined
  const hud = leftoverHudKpis({
    grain: leftoverType,
    headlines: layers?.headlines ?? null,
    inventory: layers?.inventory ?? null,
    pace: EMPTY_PUBLIC_PACE,
  })

  const tiles: string[] = []
  if (!communityName && hud.medianList != null) {
    tiles.push(`Median list $${Math.round(hud.medianList).toLocaleString()}`)
  }
  if (hud.monthsSupply != null) {
    tiles.push(`${formatMonthsOfSupply(hud.monthsSupply)} mo supply`)
  }
  if (hud.active != null) {
    tiles.push(`Active inventory ${hud.active.toLocaleString()}`)
  }

  const bars = [
    Number(hud.active ?? 0) / 50,
    Number(hud.monthsSupply ?? 0) / 8,
    Number(hud.medianList ?? 0) / 1_000_000,
    0.08,
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
          <div style={{ display: 'flex', fontSize: 20, opacity: 0.85 }}>
            {`Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {tiles.map((text) => (
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
