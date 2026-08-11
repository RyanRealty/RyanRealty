/**
 * Shared photo-stamp DOM builder for map markers (search + place maps).
 * Hex colors intentional — Google Maps marker HTML is CSS-variable isolated.
 */

export const PHOTO_STAMP_NAVY = '#102742'
export const PHOTO_STAMP_CREAM = '#faf8f4'
export const PHOTO_STAMP_WHITE = '#ffffff'

/** Zoom threshold: photo stamps instead of plain dots/pills. */
export const PHOTO_STAMP_MIN_ZOOM = 15

/**
 * Close-zoom photo stamp: square listing photo + price caption.
 */
export function buildPhotoStampElement(
  photoURL: string | null | undefined,
  priceLabel: string,
  opts?: { active?: boolean; size?: number },
): HTMLDivElement {
  const active = opts?.active ?? false
  const size = opts?.size ?? 52
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'position:relative',
    `width:${size}px`,
    'cursor:pointer',
    'transform-origin:50% 100%',
    active ? 'transform:scale(1.12)' : 'transform:scale(1)',
    'filter:drop-shadow(0 3px 10px rgba(16,39,66,0.35))',
    'transition:transform 120ms ease',
  ].join(';')

  const frame = document.createElement('div')
  frame.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:10px',
    `border:2px solid ${active ? PHOTO_STAMP_NAVY : PHOTO_STAMP_WHITE}`,
    'overflow:hidden',
    `background:${PHOTO_STAMP_NAVY}`,
    active ? `box-shadow:0 0 0 2px ${PHOTO_STAMP_WHITE}` : '',
  ].join(';')

  if (photoURL) {
    const img = document.createElement('img')
    img.src = photoURL
    img.alt = ''
    img.draggable = false
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
    frame.appendChild(img)
  }

  const cap = document.createElement('div')
  cap.style.cssText = [
    `background:${PHOTO_STAMP_NAVY}`,
    `color:${PHOTO_STAMP_WHITE}`,
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:10px',
    'font-weight:700',
    'text-align:center',
    'padding:2px 4px',
    'border-radius:0 0 8px 8px',
    'margin-top:-2px',
    'font-variant-numeric:tabular-nums',
    'letter-spacing:-0.02em',
  ].join(';')
  cap.textContent = priceLabel

  wrap.appendChild(frame)
  wrap.appendChild(cap)
  return wrap
}
