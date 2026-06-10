// brand-voice:exempt
/**
 * HomepageNeighborhoodMap — simplified line-art boundary SVG + live stats chips.
 *
 * The SVG paths are the simplified Bend neighborhood outlines from the approved
 * homepage-v3 mockup (design_system/ryan-realty/ui_kits/homepage-v3/index.html).
 * The mockup documents that the paths were generated from public.boundaries
 * (geo_type='neighborhood', ST_SimplifyPreserveTopology 0.0012) using
 * City of Bend GIS as the authoritative source.
 *
 * The live stats chips below the map are rendered from getBendNeighborhoodStats
 * (passed from the server page). The [SAMPLE] placeholders in the mockup become
 * real numbers here per §0 data accuracy.
 *
 * Hover behavior:
 *   - SVG shape fills with 8% navy on hover
 *   - Corresponding chip lifts subtly (CSS sibling trick not available cross-DOM,
 *     so we wire a simple JS class toggle on the group via onMouseEnter/Leave)
 *
 * Reduced-motion: transitions stripped via prefers-reduced-motion media query.
 */
'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Container, DisplayHeading, Eyebrow } from '@/components/site/primitives'
import { useEngagementTracking } from '@/components/site/experience/useEngagementTracking'
import type { NeighborhoodStatRow } from '@/lib/data'

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  const k = Math.round(n / 1000) * 1000
  // e.g. $875,000
  return `$${k.toLocaleString()}`
}

type Props = {
  neighborhoodStats: NeighborhoodStatRow[]
}

// Slug → chip hover state key
const SLUG_LABEL_MAP: Record<string, string> = {
  'bend-awbrey-butte': 'awbrey-butte',
  'bend-northwest-crossing': 'northwest-crossing',
  'bend-river-west': 'river-west',
  'bend-old-bend': 'old-bend',
  'bend-century-west': 'century-west',
  'bend-summit-west': 'summit-west',
  'bend-tetherow': 'tetherow',
}

export default function HomepageNeighborhoodMap({ neighborhoodStats }: Props) {
  const ref = useRef<HTMLElement>(null)
  useEngagementTracking('neighborhood-map', { ref, pageType: 'homepage', position: 3 })

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  const statsMap = new Map(neighborhoodStats.map((s) => [s.geoSlug, s]))

  const shapeBaseStyle = {
    fill: 'transparent',
    stroke: 'var(--rr-navy, #102742)',
    strokeWidth: '1.5',
    opacity: '0.28',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
  }

  const shapeHoveredStyle = {
    fill: 'rgba(16,39,66,0.08)',
    opacity: '1',
    strokeWidth: '2',
  }

  function makeShapeStyle(slug: string) {
    return hoveredSlug === slug
      ? { ...shapeBaseStyle, ...shapeHoveredStyle }
      : shapeBaseStyle
  }

  return (
    <section
      ref={ref}
      className="py-16 md:py-20 bg-background border-t border-border"
      aria-labelledby="neigh-heading"
    >
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">

          {/* Left: intro text + chips */}
          <div className="max-w-[400px]">
            <Eyebrow className="mb-4">Neighborhood explorer</Eyebrow>
            <DisplayHeading as="h2" id="neigh-heading" className="mb-6">
              We map this town at boundary depth.
            </DisplayHeading>
            <p className="text-base leading-relaxed text-foreground/60 mb-8">
              Our database covers 14 Bend neighborhoods with verified boundary
              polygons, sold history, and market pulse updated every 10 minutes.
              You get the numbers for the actual street you are looking at.
            </p>
            <a
              href="/cities/bend"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all"
            >
              Explore Bend neighborhoods
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>

            {/* Neighborhood chips — live stats */}
            <div className="flex flex-wrap gap-3 mt-8">
              {neighborhoodStats.map((stat) => {
                const chipSlug = SLUG_LABEL_MAP[stat.geoSlug] ?? stat.geoSlug
                const isHovered = hoveredSlug === stat.geoSlug
                return (
                  <Link
                    key={stat.geoSlug}
                    href={stat.href}
                    className={cn(
                      'flex flex-col px-4 py-3 min-w-[140px] rounded-xl border transition-all',
                      isHovered
                        ? 'border-primary shadow-md -translate-y-0.5'
                        : 'border-border bg-white hover:border-primary hover:shadow-md hover:-translate-y-0.5',
                    )}
                    onMouseEnter={() => setHoveredSlug(stat.geoSlug)}
                    onMouseLeave={() => setHoveredSlug(null)}
                    aria-label={`${stat.label}: ${stat.activeCount != null ? stat.activeCount + ' active' : ''} ${stat.medianListPrice != null ? fmtPrice(stat.medianListPrice) + ' median' : ''}`}
                  >
                    <span className="text-[13px] font-semibold text-foreground mb-0.5">{stat.label}</span>
                    <div className="flex gap-2 text-[11px] tabular-nums text-foreground/50">
                      {stat.medianListPrice != null ? (
                        <span className="font-semibold text-foreground">{fmtPrice(stat.medianListPrice)}</span>
                      ) : null}
                      {stat.activeCount != null ? (
                        <span>· {stat.activeCount} active</span>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right: SVG boundary map */}
          <div className="relative w-full max-w-[580px] mx-auto md:mx-0">
            <svg
              viewBox="0 0 580 520"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto overflow-visible"
              aria-label="Bend neighborhood boundaries from the Ryan Realty boundary database"
              role="img"
            >
              <defs>
                <style>{`
                  .neigh-label {
                    font-family: 'Geist', 'Geist Sans', system-ui, sans-serif;
                    font-size: 13px;
                    font-weight: 600;
                    fill: #102742;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                  }
                  .neigh-group:hover .neigh-label { opacity: 1; }
                  @media (prefers-reduced-motion: reduce) {
                    .neigh-label { transition: none; }
                  }
                `}</style>
              </defs>

              {/* Awbrey Butte */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-awbrey-butte')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-awbrey-butte')}
                  d="M 371.2 146.5 L 351.0 158.3 L 352.6 174.2 L 231.5 173.9 L 231.5 154.6 L 220.2 145.0 L 174.0 135.4 L 174.0 77.6 L 204.8 46.5 L 227.7 60.1 L 281.0 38.8 L 285.8 52.4 L 304.7 28.1 L 330.7 28.0 L 338.8 41.8 L 329.2 58.4 L 364.4 93.8 L 376.6 124.8 L 371.2 146.5 Z"
                />
                <text className="neigh-label" x="291" y="105" textAnchor="middle">Awbrey Butte</text>
              </g>

              {/* Century West */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-century-west')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-century-west')}
                  d="M 164.0 323.0 L 151.3 299.3 L 162.2 302.3 L 156.1 296.4 L 176.4 289.3 L 186.4 269.8 L 164.4 273.2 L 187.5 258.5 L 198.1 270.5 L 222.4 274.8 L 229.1 292.3 L 276.2 289.7 L 277.0 316.3 L 259.5 338.9 L 281.3 330.6 L 284.2 361.2 L 257.4 385.7 L 246.1 413.7 L 220.5 424.2 L 197.5 456.7 L 174.9 467.5 L 172.8 482.4 L 151.8 492.0 L 152.9 427.3 L 191.5 413.1 L 191.9 385.9 L 210.9 385.7 L 211.3 347.5 L 183.9 344.2 L 170.3 324.7 L 177.2 311.8 L 164.0 323.0 Z"
                />
                <text className="neigh-label" x="228" y="335" textAnchor="middle">Century West</text>
              </g>

              {/* Old Bend */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-old-bend')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-old-bend')}
                  d="M 319.6 278.7 L 299.1 255.0 L 319.2 222.2 L 369.9 246.5 L 369.9 269.8 L 326.0 270.4 L 319.6 278.7 Z"
                />
                <text className="neigh-label" x="344" y="260" textAnchor="middle">Old Bend</text>
              </g>

              {/* Orchard District */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-orchard-district')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-orchard-district')}
                  d="M 393.0 120.3 L 421.4 106.1 L 465.7 109.6 L 497.4 99.1 L 470.1 110.8 L 459.8 136.6 L 478.8 168.7 L 474.0 204.2 L 486.2 213.5 L 487.0 227.4 L 479.6 245.1 L 440.5 232.2 L 440.5 246.4 L 370.6 246.5 L 375.4 143.7 L 380.0 127.6 L 382.4 136.5 L 393.0 120.3 Z"
                />
                <text className="neigh-label" x="450" y="165" textAnchor="middle">Orchard District</text>
              </g>

              {/* River West */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-river-west')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-river-west')}
                  d="M 376.5 126.9 L 369.9 246.5 L 315.6 223.8 L 299.0 255.9 L 319.6 278.7 L 309.3 290.3 L 229.1 292.3 L 226.9 279.8 L 248.8 279.9 L 250.4 250.5 L 250.4 242.9 L 231.4 237.4 L 231.4 204.1 L 252.2 210.4 L 231.4 191.0 L 185.5 183.2 L 199.3 141.4 L 231.5 154.6 L 231.5 173.9 L 352.6 174.2 L 351.0 158.3 L 371.2 146.5 L 376.5 126.9 Z"
                />
                <text className="neigh-label" x="280" y="222" textAnchor="middle">River West</text>
              </g>

              {/* Summit West */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-summit-west')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-summit-west')}
                  d="M 116.0 116.3 L 174.0 116.1 L 174.0 135.4 L 199.3 141.4 L 185.5 183.2 L 231.4 191.0 L 251.7 209.2 L 231.4 204.1 L 231.4 237.4 L 250.4 242.9 L 248.8 279.7 L 199.6 271.1 L 187.5 258.5 L 98.5 268.9 L 100.3 259.4 L 85.0 258.9 L 90.9 237.2 L 128.9 223.3 L 143.5 193.0 L 137.6 182.1 L 146.7 178.2 L 135.4 173.8 L 135.4 159.3 L 120.1 159.4 L 119.9 135.3 L 116.1 154.5 L 96.7 154.4 L 96.6 173.5 L 82.1 173.6 L 116.1 78.2 L 116.0 116.3 Z"
                />
                <text className="neigh-label" x="155" y="210" textAnchor="middle">Summit West</text>
              </g>

              {/* Tetherow */}
              <g
                className="neigh-group"
                onMouseEnter={() => setHoveredSlug('bend-tetherow')}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <path
                  style={makeShapeStyle('bend-tetherow')}
                  d="M 133.5 424.6 L 135.4 334.3 L 156.5 328.1 L 138.1 291.3 L 154.9 273.3 L 161.7 281.1 L 186.3 269.9 L 150.9 300.5 L 179.2 344.9 L 211.4 347.6 L 211.1 385.8 L 186.8 386.0 L 183.7 411.7 L 191.6 411.7 L 152.7 426.6 L 133.5 424.6 Z"
                />
                <text className="neigh-label" x="157" y="379" textAnchor="middle">Tetherow</text>
              </g>

              {/* North compass rose */}
              <g transform="translate(548, 36)">
                <circle r="16" fill="none" stroke="rgba(16,39,66,0.12)" strokeWidth="1"/>
                <text x="0" y="-5" textAnchor="middle" style={{ fontFamily: 'Geist, system-ui, sans-serif', fontSize: '9px', fontWeight: '700', fill: '#102742' }}>N</text>
                <line x1="0" y1="-14" x2="0" y2="14" stroke="rgba(16,39,66,0.25)" strokeWidth="1"/>
                <line x1="-14" y1="0" x2="14" y2="0" stroke="rgba(16,39,66,0.15)" strokeWidth="1"/>
              </g>
            </svg>
          </div>
        </div>
      </Container>
    </section>
  )
}
