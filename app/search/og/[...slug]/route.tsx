import { ImageResponse } from 'next/og'
import { getPresetBySlug } from '@/lib/search-presets'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

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
  const citySlug = slug?.[0] ?? ''
  const second = slug?.[1] ?? ''
  const third = slug?.[2] ?? ''
  const preset = getPresetBySlug(third || second)
  const city = citySlug ? unslug(citySlug) : 'Central Oregon'
  const subdivision = citySlug && second && !getPresetBySlug(second) ? unslug(second) : null
  const place = subdivision ? `${subdivision}, ${city}` : city
  const title = preset ? `${preset.label} in ${place}` : `Homes for Sale in ${place}`

  const pulse = citySlug
    ? await getLiveMarketPulse({ geoType: 'city', geoSlug: canonicalCityCacheSlug(citySlug) })
    : null

  const active = pulse?.active_count != null ? Math.round(Number(pulse.active_count)).toLocaleString() : 'N/A'
  const mos =
    pulse?.months_of_supply != null && Number.isFinite(Number(pulse.months_of_supply))
      ? `${formatMonthsOfSupply(Number(pulse.months_of_supply))} mo supply`
      : 'N/A'
  const median = pulse?.median_list_price ? `$${Math.round(Number(pulse.median_list_price)).toLocaleString()}` : 'N/A'
  const label = pulse?.market_health_label ?? 'Live'

  const bars = [
    Number(pulse?.active_count ?? 0) / 120,
    Number(pulse?.months_of_supply ?? 0) / 8,
    Number(pulse?.new_count_7d ?? 0) / 30,
    Number(pulse?.median_list_price ?? 0) / 1_000_000,
  ].map((value) => Math.max(0.08, Math.min(1, Number.isFinite(value) ? value : 0.08)))

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(120deg, #0e243a 0%, #1b3e66 60%, #2d5f95 100%)',
          color: '#fff',
          padding: 44,
          fontFamily: 'Arial',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 24, opacity: 0.85 }}>Ryan Realty Search Snapshot</span>
          <span style={{ marginTop: 8, fontSize: 52, fontWeight: 700, lineHeight: 1.08 }}>{title}</span>
          <span style={{ marginTop: 8, fontSize: 22, opacity: 0.9 }}>
            {label === 'Live' ? 'Live market signal' : label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {[`Active ${active}`, mos, `Median list ${median}`].map((text) => (
            <div
              key={text}
              style={{
                display: 'flex',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 14,
                padding: '14px 18px',
                fontSize: 20,
              }}
            >
              {text}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
          {bars.map((bar, index) => (
            <div
              key={index}
              style={{
                width: 72,
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
