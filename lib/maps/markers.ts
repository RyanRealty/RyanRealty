/**
 * lib/maps/markers.ts
 *
 * Shared visual primitives for ALL Google Maps instances on the site.
 *
 * Rules:
 *   - Inline hex is intentional: Google Maps SVG markers and InfoWindow HTML
 *     are Tailwind-isolated (they do not inherit app CSS variables or Tailwind
 *     stylesheet). Only raw hex values produce the correct brand colors here.
 *   - This file is listed in .design-token-lint-ignore (lib/maps/markers.ts)
 *     because of the Google Maps SVG marker + InfoWindow isolation requirement.
 *
 * Every map component imports from here. If you change a color or layout,
 * change it ONCE in this file and it applies everywhere.
 */

import { getV3MapOptions, V3_BASEMAP_STYLE } from '@/lib/maps/v3-basemap'

// Brand tokens (hex required for Google Maps SVG/InfoWindow isolation).
/** Excluded-shape tint for map draw tools (destructive red at map-overlay opacity). */
export const MAP_EXCLUDE_RED = '#dc2626'

export const MAP_NAVY = '#102742'
export const MAP_WHITE = '#ffffff'
/** Cream invert fill for selected/hovered pins (Maps overlay cannot read CSS vars). */
export const MAP_CREAM = '#faf8f4'
export const MAP_TEXT_DARK = '#1a1a1a'
export const MAP_TEXT_MID = '#555555'
export const MAP_TEXT_LIGHT = '#777777'
export const MAP_RED_HEART = '#dc2626'

// ─── Shared map options ────────────────────────────────────────────────────────

/**
 * Base Google Maps options shared across all map surfaces.
 * All maps show zoom controls (top-right), type control, no street view,
 * fullscreen, and cooperative gesture handling so the page stays scrollable.
 *
 * Callers can spread-override individual fields (e.g. NeighborhoodMap
 * hides type control and fullscreen for its embedded-map context).
 */
export function getBaseMapOptions(): google.maps.MapOptions {
  const opts: google.maps.MapOptions = {
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    gestureHandling: 'cooperative',
  }
  // CRITICAL: this may be called during render BEFORE the Google Maps API
  // script has loaded (e.g. a map component computing options on first paint).
  // Touching google.maps.ControlPosition / MapTypeId then throws "Cannot read
  // properties of undefined", which crashes the map and takes down the whole
  // page via the error boundary. Only touch the enums once they exist; the
  // controls still render at their defaults otherwise.
  if (typeof google !== 'undefined' && google.maps?.ControlPosition) {
    opts.zoomControlOptions = { position: google.maps.ControlPosition.RIGHT_TOP }
  }
  if (typeof google !== 'undefined' && google.maps?.MapTypeId && google.maps?.MapTypeControlStyle) {
    // Offer roadmap / satellite / hybrid / terrain. The
    // dropdown style keeps the control compact on the search map's chrome.
    opts.mapTypeControlOptions = {
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
      mapTypeIds: [
        google.maps.MapTypeId.ROADMAP,
        google.maps.MapTypeId.SATELLITE,
        google.maps.MapTypeId.HYBRID,
        google.maps.MapTypeId.TERRAIN,
      ],
    }
  }
  return opts
}

/**
 * Explore / place-page map options (city, community, subdivision, neighborhood,
 * ZIP, and every V3Field mapSlot).
 *
 * SITE-44, 2026-09-09: this function used to re-enable Google's own map-type
 * DROPDOWN at TOP_RIGHT and inherit Google's +/- zoom stack from
 * getBaseMapOptions, on top of a basemap that fell back to the Cloud Map ID.
 * That is exactly the "Google default map" the taste table named on /zip. Both
 * controls are gone and the cartography is now the one style array in
 * lib/maps/v3-basemap.ts. Cooperative gestures so page scroll still works.
 */
export function getExploreMapOptions(optsExtra?: {
  /**
   * Retained for call-site compatibility and now inert: there is no Cloud Map
   * ID path on a public map any more (see lib/maps/v3-basemap.ts). Every caller
   * gets the readable style array.
   */
  preferMapId?: boolean
}): google.maps.MapOptions {
  void optsExtra
  return getV3MapOptions({ gestureHandling: 'cooperative' })
}

/**
 * Search-map options — greedy gestures, the V3 navy-on-cream basemap.
 * Google tiles stay. Google Draw / Map dropdown / zoom / Roboto chrome is off.
 * MapChrome (Map/Satellite + zoom) owns top-right; Draw owns top-left.
 */
export function getSearchMapOptions(): google.maps.MapOptions {
  return getV3MapOptions({ gestureHandling: 'greedy' })
}

/**
 * The editorial search basemap. One name, one array, and it is the V3 one:
 * every public map — search, place Field, listing locator, homepage explore —
 * paints the same navy-on-cream cartography as V3Atlas. Kept as an alias so the
 * older call sites and their tests keep resolving; new code should import
 * V3_BASEMAP_STYLE directly.
 */
export const MAP_SEARCH_STYLES: google.maps.MapTypeStyle[] = V3_BASEMAP_STYLE

/**
 * POI-suppressed map style used when embedding a boundary/neighborhood map.
 * Removes distracting points of interest, transit overlays, and fine-grained
 * parcel/neighborhood labels so the polygon boundary is the focal element.
 */
export const MAP_BOUNDARY_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

// ─── Price-pill SVG marker ─────────────────────────────────────────────────────

/**
 * Build a price-pill SVG data-URI for a Google Maps custom marker icon.
 *
 * Produces a navy rounded-rect with white tabular-nums price text and a
 * downward caret pointing to the exact lat/lng coordinate.
 *
 * Width is dynamic so short labels ("$1.2M") and long ones ("$1,200k") both fit.
 * Used by SearchMapClustered for clustering markers and ListingMapGoogle for
 * single-listing markers, replacing the old teal-circle approach everywhere.
 */
export function buildPricePillIcon(
  label: string,
  opts?: { hover?: boolean; active?: boolean },
): google.maps.Icon {
  const hover = opts?.hover ?? false
  const active = opts?.active ?? false
  const fontSize = hover ? 14 : 13
  const hPad = 12
  const vPad = hover ? 8 : 6
  // Active (clicked / InfoWindow-open) pills get a white outline ring so the
  // selected home reads clearly on the map. The ring lives
  // inside an outer stroke padding so the pill geometry (and caret) is unchanged.
  const ring = active ? 2 : 0
  // Approximate character width at the given font size.
  const charW = fontSize * 0.6
  const textW = Math.ceil(label.length * charW)
  const W = textW + hPad * 2
  const H = fontSize + vPad * 2
  const R = Math.floor(H / 2)
  // Caret (downward triangle) pointing to the exact lat/lng.
  const caretH = 6
  const caretW = 10
  // Pad the SVG canvas by the ring width on each side so the stroke is not clipped.
  const totalW = W + ring * 2
  const totalH = H + caretH + ring * 2
  const ox = ring // x-offset of the pill body inside the padded canvas
  const oy = ring // y-offset of the pill body inside the padded canvas
  const cx = ox + W / 2

  const ringAttrs = active
    ? ` stroke="${MAP_WHITE}" stroke-width="${ring}"`
    : ''

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">` +
    `<rect x="${ox}" y="${oy}" width="${W}" height="${H}" rx="${R}" ry="${R}" fill="${MAP_NAVY}"${ringAttrs}/>` +
    `<polygon points="${cx - caretW / 2},${oy + H} ${cx + caretW / 2},${oy + H} ${cx},${oy + H + caretH}" fill="${MAP_NAVY}"/>` +
    `<text x="${cx}" y="${oy + H / 2 + fontSize * 0.36}" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600" fill="${MAP_WHITE}" text-anchor="middle" dominant-baseline="auto">${label}</text>` +
    `</svg>`

  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(totalW, totalH),
    // Anchor at the caret tip: horizontal center, full height (bottom of caret).
    anchor: new google.maps.Point(cx, oy + H + caretH),
  }
}

/**
 * Cluster badge icon: navy circle with white count, matching the price-pill
 * brand palette. Used by SearchMapClustered's MarkerClusterer renderer.
 */
export function buildClusterIcon(count: number): google.maps.Icon {
  const clusterLabel = String(count)
  const fontSize = count >= 100 ? 11 : 13
  const size = count >= 100 ? 36 : 32

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${MAP_NAVY}" opacity="0.92"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="none" stroke="${MAP_WHITE}" stroke-width="1.5"/>` +
    `<text x="${size / 2}" y="${size / 2 + fontSize * 0.38}" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="700" fill="${MAP_WHITE}" text-anchor="middle">${clusterLabel}</text>` +
    `</svg>`

  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

// ─── Price label formatter ─────────────────────────────────────────────────────

/**
 * Format a listing price as a compact pill label.
 * Matches the convention used across all map markers site-wide.
 *   $1,200,000 -> "$1.2M"
 *   $895,000   -> "$895k"
 *   $500       -> "$500"
 */
export function formatPriceLabel(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}k`
  return `$${price}`
}

// ─── InfoWindow card HTML ──────────────────────────────────────────────────────

export type InfoWindowListingData = {
  price?: number | null
  photoURL?: string | null
  streetNumber?: string | null
  streetName?: string | null
  streetSuffix?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  bedroomsTotal?: number | null
  bathroomsTotal?: number | null
  sqft?: number | null
  href: string
  isSaved?: boolean
}

/**
 * Build the inner HTML string for a shared listing-card InfoWindow.
 *
 * Google Maps InfoWindows render inside an isolated DOM context that does NOT
 * inherit the app's Tailwind stylesheet or CSS custom properties. All styles
 * must be inline with literal hex values. This is the ONLY place where brand
 * hex may appear in InfoWindow content.
 *
 * The card contains:
 *   - Hero photo (when available)
 *   - Price in tabular-nums (navy, bold)
 *   - Street address + city/state/zip
 *   - Beds / baths / sqft stats
 *   - "View listing" CTA button (navy)
 */
export function buildInfoWindowHTML(listing: InfoWindowListingData): string {
  const priceStr =
    listing.price != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(Number(listing.price))
      : null

  const streetLine = [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ')
  const cityLine = [listing.city, listing.state, listing.postalCode].filter(Boolean).join(' ')
  const addressLine = [streetLine, cityLine].filter(Boolean).join(', ')

  const statParts: string[] = []
  if (listing.bedroomsTotal != null) statParts.push(`${listing.bedroomsTotal} bd`)
  if (listing.bathroomsTotal != null) statParts.push(`${listing.bathroomsTotal} ba`)
  if (listing.sqft != null) statParts.push(`${Number(listing.sqft).toLocaleString()} sqft`)
  const statsLine = statParts.join(' · ')

  const photoAlt = streetLine || 'Listing photo'

  // Note: intentional use of template-literal HTML. All style values are literal
  // hex because InfoWindow content is Tailwind-isolated.
  // 2026 card: photo hero, price bold, address, stats, full-width CTA button.
  const MAP_CREAM = '#faf8f4'
  const MAP_BORDER = 'rgba(16,39,66,0.10)'

  let html =
    `<div style="width:264px;font-family:system-ui,-apple-system,sans-serif;` +
    `color:${MAP_TEXT_DARK};line-height:1.4;border-radius:12px;overflow:hidden;` +
    `background:${MAP_CREAM};border:1px solid ${MAP_BORDER};">`

  if (listing.photoURL) {
    html +=
      `<div style="width:100%;height:152px;overflow:hidden;background:#e5e5e5;">` +
      `<img src="${listing.photoURL}" alt="${photoAlt}" width="264" height="152" loading="lazy"` +
      ` style="width:100%;height:100%;object-fit:cover;display:block;"/>` +
      `</div>`
  }

  html += `<div style="padding:12px 14px 14px;">`

  if (priceStr) {
    html +=
      `<div style="font-weight:800;font-size:18px;color:${MAP_NAVY};font-variant-numeric:tabular-nums;letter-spacing:-0.01em;">` +
      priceStr +
      (listing.isSaved
        ? `<span style="margin-left:7px;color:${MAP_RED_HEART};font-size:15px;" aria-hidden>&#9829;</span>`
        : '') +
      `</div>`
  }

  if (streetLine) {
    html += `<div style="font-size:13px;font-weight:600;color:${MAP_TEXT_DARK};margin-top:4px;">${streetLine}</div>`
  }

  if (cityLine) {
    html += `<div style="font-size:12px;color:${MAP_TEXT_MID};margin-top:1px;">${cityLine}</div>`
  }

  if (statsLine) {
    html +=
      `<div style="font-size:12px;color:${MAP_TEXT_MID};margin-top:6px;font-variant-numeric:tabular-nums;` +
      `padding-top:6px;border-top:1px solid ${MAP_BORDER};">` +
      statsLine +
      `</div>`
  }

  html +=
    `<a href="${listing.href}"` +
    ` style="display:block;margin-top:12px;padding:9px 0;border-radius:8px;` +
    `background:${MAP_NAVY};color:${MAP_WHITE};font-size:13px;font-weight:700;` +
    `text-decoration:none;cursor:pointer;text-align:center;letter-spacing:0.01em;">` +
    `View listing &rarr;` +
    `</a>`

  html += `</div></div>`
  return html
}
