/**
 * The box around a signature's ink. Pure; runs on the phone (the signature
 * pad crops a mark as it is adopted) and on the server (the sealer crops a
 * mark adopted before that).
 *
 * Why: a typed signature was a 600 x 160 canvas with the name at 64 px in its
 * left half, and the sealer fit the whole canvas, blank and all, into the
 * box. On the 020's 17 pt signature line "Matt Ryan" printed about 7 pt tall
 * and the initials about 4 pt, floating above the line (sealed 2026-09-30).
 */

export type InkBox = { x: number; y: number; w: number; h: number }

/** A pixel is ink when it is not transparent and not paper white (an upload's background). */
const ALPHA_MIN = 16
const PAPER_MIN = 235

/** The smallest box holding every ink pixel of an RGBA image, padded a little; null when there is none. */
export function inkBounds(rgba: ArrayLike<number>, width: number, height: number, pad = 2): InkBox | null {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (rgba[i + 3]! < ALPHA_MIN) continue
      if (rgba[i]! >= PAPER_MIN && rgba[i + 1]! >= PAPER_MIN && rgba[i + 2]! >= PAPER_MIN) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  const x = Math.max(0, x0 - pad)
  const y = Math.max(0, y0 - pad)
  return { x, y, w: Math.min(width, x1 + pad + 1) - x, h: Math.min(height, y1 + pad + 1) - y }
}

/**
 * Where a mark sits in its box (points, PDF y up): as large as the box
 * allows, its bottom on the box's bottom edge (the printed line), from the
 * left like a hand would sign.
 */
export function markPlacement(
  mark: { w: number; h: number },
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const room = { w: Math.max(1, box.w - 2), h: Math.max(1, box.h - 1) }
  const scale = Math.min(room.w / mark.w, room.h / mark.h)
  return { x: box.x + 1, y: box.y + 0.5, w: mark.w * scale, h: mark.h * scale }
}
