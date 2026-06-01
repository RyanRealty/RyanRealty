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

// Brand tokens (hex required for Google Maps SVG/InfoWindow isolation).
export const MAP_NAVY = '#102742'
export const MAP_WHITE = '#ffffff'
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
  return {
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    gestureHandling: 'cooperative',
  }
}

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
  opts?: { hover?: boolean },
): google.maps.Icon {
  const hover = opts?.hover ?? false
  const fontSize = hover ? 14 : 13
  const hPad = 12
  const vPad = hover ? 8 : 6
  // Approximate character width at the given font size.
  const charW = fontSize * 0.6
  const textW = Math.ceil(label.length * charW)
  const W = textW + hPad * 2
  const H = fontSize + vPad * 2
  const R = Math.floor(H / 2)
  // Caret (downward triangle) pointing to the exact lat/lng.
  const caretH = 6
  const caretW = 10
  const totalH = H + caretH
  const cx = W / 2

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="${R}" ry="${R}" fill="${MAP_NAVY}"/>` +
    `<polygon points="${cx - caretW / 2},${H} ${cx + caretW / 2},${H} ${cx},${totalH}" fill="${MAP_NAVY}"/>` +
    `<text x="${cx}" y="${H / 2 + fontSize * 0.36}" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600" fill="${MAP_WHITE}" text-anchor="middle" dominant-baseline="auto">${label}</text>` +
    `</svg>`

  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(W, totalH),
    anchor: new google.maps.Point(cx, totalH),
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

  const streetLine = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ')
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
  let html = `<div style="width:240px;font-family:system-ui,-apple-system,sans-serif;color:${MAP_TEXT_DARK};line-height:1.4;">`

  if (listing.photoURL) {
    html +=
      `<div style="margin-bottom:10px;border-radius:8px;overflow:hidden;aspect-ratio:4/3;">` +
      `<img src="${listing.photoURL}" alt="${photoAlt}" width="240" height="180" loading="lazy"` +
      ` style="width:100%;height:100%;object-fit:cover;display:block;"/>` +
      `</div>`
  }

  if (priceStr) {
    html +=
      `<div style="font-weight:700;font-size:16px;color:${MAP_NAVY};font-variant-numeric:tabular-nums;">` +
      priceStr +
      (listing.isSaved
        ? `<span style="margin-left:6px;color:${MAP_RED_HEART};font-size:14px;" aria-hidden>&#9829;</span>`
        : '') +
      `</div>`
  }

  if (addressLine) {
    html += `<div style="font-size:13px;color:${MAP_TEXT_MID};margin-top:2px;">${addressLine}</div>`
  }

  if (statsLine) {
    html +=
      `<div style="font-size:12px;color:${MAP_TEXT_LIGHT};margin-top:3px;font-variant-numeric:tabular-nums;">` +
      statsLine +
      `</div>`
  }

  html +=
    `<a href="${listing.href}"` +
    ` style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:8px;background:${MAP_NAVY};color:${MAP_WHITE};font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;">` +
    `View listing` +
    `</a>`

  html += `</div>`
  return html
}
