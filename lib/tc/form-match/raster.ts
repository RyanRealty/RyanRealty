/**
 * Page images as ink masks, and how one page lines up with another.
 *
 * The Vault holds the licensed blank of every form it uses (tc_form_versions).
 * A filled copy of the same release is that blank plus ink: the typed values,
 * the signatures, the initials. So a copy is identified by how much of the
 * blank's ink it carries once the two are lined up (a copy of the same release
 * carries ~100% of it; another form, or another release of the same form,
 * well under 70%), and a field is filled when the copy has ink in the field's
 * box that the blank does not. Measured on production copies 2026-09-24: OREF
 * 015 01/2026 and OREF 020 01/2026 copies match their blanks at 100.0% with no
 * offset; OREF 003/004 01/2025 copies match the 01/2026 blanks at 45-62%.
 *
 * Pure: masks in, numbers out. Rendering lives in pdf-raster.ts.
 */

/** One byte per pixel, 1 = ink. Scale 1: a letter page is 612 × 792. */
export type Mask = { w: number; h: number; bits: Uint8Array }
export type Rect = { x0: number; y0: number; x1: number; y1: number }

export const INK_THRESHOLD = 150

export function maskFromGray(gray: Uint8Array, w: number, h: number, threshold = INK_THRESHOLD): Mask {
  const bits = new Uint8Array(w * h)
  for (let i = 0; i < bits.length; i++) bits[i] = gray[i] < threshold ? 1 : 0
  return { w, h, bits }
}

export function inkCount(m: Mask): number {
  let n = 0
  for (let i = 0; i < m.bits.length; i++) n += m.bits[i]
  return n
}

/** Grow every ink pixel by r in each direction (separable, O(pixels)). */
export function dilate(m: Mask, r = 1): Mask {
  if (r <= 0) return m
  const { w, h } = m
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let last = -Infinity
    for (let x = 0; x < w; x++) {
      if (m.bits[row + x]) last = x
      if (x - last <= r) tmp[row + x] = 1
    }
    last = Infinity
    for (let x = w - 1; x >= 0; x--) {
      if (m.bits[row + x]) last = x
      if (last - x <= r) tmp[row + x] = 1
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let last = -Infinity
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y
      if (y - last <= r) out[y * w + x] = 1
    }
    last = Infinity
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y
      if (last - y <= r) out[y * w + x] = 1
    }
  }
  return { w, h, bits: out }
}

export const DESCRIPTOR_COLS = 16
export const DESCRIPTOR_ROWS = 20

/**
 * Ink density per cell of a 16 × 20 grid, 0-255 (density × 1000, capped).
 * Cheap enough to compare one page against every template page, so only the
 * few nearest are lined up pixel by pixel.
 */
export function descriptor(m: Mask): Uint8Array {
  const out = new Uint8Array(DESCRIPTOR_COLS * DESCRIPTOR_ROWS)
  const cw = m.w / DESCRIPTOR_COLS
  const ch = m.h / DESCRIPTOR_ROWS
  for (let r = 0; r < DESCRIPTOR_ROWS; r++) {
    for (let c = 0; c < DESCRIPTOR_COLS; c++) {
      const x0 = Math.floor(c * cw), x1 = Math.floor((c + 1) * cw)
      const y0 = Math.floor(r * ch), y1 = Math.floor((r + 1) * ch)
      let n = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) n += m.bits[y * m.w + x]
      const area = Math.max(1, (x1 - x0) * (y1 - y0))
      out[r * DESCRIPTOR_COLS + c] = Math.min(255, Math.round((n / area) * 1000))
    }
  }
  return out
}

/**
 * How far a copy's grid is from a template's: the template's ink the copy is
 * missing counts fully (a copy carries all of its blank); ink the copy adds
 * (typed values, signatures) counts a twentieth, so a heavily filled copy
 * still ranks its own form first. Measured 2026-09-24 on 110 matched pages:
 * the true template ranked first on all 110 (a quarter weight ranked one
 * filled OREF 004 page 79th). Lower is closer.
 */
export function descriptorGap(template: Uint8Array, copy: Uint8Array): number {
  let missing = 0
  let extra = 0
  let total = 0
  for (let i = 0; i < template.length; i++) {
    const t = template[i], c = copy[i]
    total += t
    if (t > c) missing += t - c
    else extra += c - t
  }
  return (missing + extra / 20) / Math.max(1, total)
}

/** Every stride-th ink pixel of a template, as flat indices. */
export function inkPoints(m: Mask, stride = 3): Int32Array {
  const all: number[] = []
  let k = 0
  for (let i = 0; i < m.bits.length; i++) {
    if (m.bits[i]) {
      if (k % stride === 0) all.push(i)
      k++
    }
  }
  return Int32Array.from(all)
}

export type Alignment = { coverage: number; dx: number; dy: number }

/**
 * Line a template up with a copy: the shift (within ±range px) at which the
 * most of the template's ink lands on the copy's ink. `copy` should be
 * dilated by 1 so anti-aliasing and a half-pixel offset do not count as
 * missing ink.
 */
export function align(points: Int32Array, templateW: number, copy: Mask, range = 24, step = 2, exact?: Mask): Alignment {
  if (!points.length) return { coverage: 0, dx: 0, dy: 0 }
  const hitsOn = (target: Mask, dx: number, dy: number) => {
    let hit = 0
    for (let k = 0; k < points.length; k++) {
      const i = points[k]
      const x = (i % templateW) + dx
      const y = ((i / templateW) | 0) + dy
      if (x >= 0 && x < target.w && y >= 0 && y < target.h && target.bits[y * target.w + x]) hit++
    }
    return hit / points.length
  }
  const hits = (dx: number, dy: number) => {
    let hit = 0
    for (let k = 0; k < points.length; k++) {
      const i = points[k]
      const x = (i % templateW) + dx
      const y = ((i / templateW) | 0) + dy
      if (x >= 0 && x < copy.w && y >= 0 && y < copy.h && copy.bits[y * copy.w + x]) hit++
    }
    return hit / points.length
  }
  let best: Alignment = { coverage: hits(0, 0), dx: 0, dy: 0 }
  // Copies of one printing nearly always sit at no offset: skip the wide search then.
  const wide = best.coverage < 0.99
  for (let dy = -range; wide && dy <= range; dy += step) {
    for (let dx = -range; dx <= range; dx += step) {
      const c = hits(dx, dy)
      if (c > best.coverage) best = { coverage: c, dx, dy }
    }
  }
  // Fine search around the coarse best. Against a dilated copy the best
  // coverage is a small plateau around the true shift; its centre is the
  // shift (a one-pixel error would thin every rule when copies are merged).
  const { dx: bx, dy: by } = best
  const fine: Alignment[] = []
  for (let dy = by - step - 1; dy <= by + step + 1; dy++) {
    for (let dx = bx - step - 1; dx <= bx + step + 1; dx++) {
      const c = hits(dx, dy)
      fine.push({ coverage: c, dx, dy })
      if (c > best.coverage) best = { coverage: c, dx, dy }
    }
  }
  if (exact) {
    // Undilated, the overlap peaks sharply at the true shift.
    let top = { score: -1, dx: best.dx, dy: best.dy }
    for (const f of fine) {
      if (f.coverage < best.coverage - 0.05) continue
      const score = hitsOn(exact, f.dx, f.dy)
      if (score > top.score) top = { score, dx: f.dx, dy: f.dy }
    }
    return fine.find((f) => f.dx === top.dx && f.dy === top.dy) ?? best
  }
  const plateau = fine.filter((f) => f.coverage >= best.coverage - 0.003)
  const cx = Math.round(plateau.reduce((s, f) => s + f.dx, 0) / plateau.length)
  const cy = Math.round(plateau.reduce((s, f) => s + f.dy, 0) / plateau.length)
  const centre = fine.find((f) => f.dx === cx && f.dy === cy)
  return centre && centre.coverage >= best.coverage - 0.003 ? centre : best
}

/** Share of a rect (template coordinates) that is ink on a mask shifted by (dx, dy). */
export function inkRatio(m: Mask, r: Rect, dx = 0, dy = 0): { ratio: number; pixels: number } {
  let n = 0
  let t = 0
  const x0 = Math.max(0, Math.round(r.x0)), x1 = Math.min(m.w, Math.round(r.x1))
  const y0 = Math.max(0, Math.round(r.y0)), y1 = Math.min(m.h, Math.round(r.y1))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      t++
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && xx < m.w && yy >= 0 && yy < m.h && m.bits[yy * m.w + xx]) n++
    }
  }
  return { ratio: t ? n / t : 0, pixels: n }
}

/**
 * Ink the copy carries in a rect beyond what the template prints there.
 * The template side is dilated so a one-pixel wobble in the printed line
 * under a signature is not read as a signature.
 */
export function addedInk(template: Mask, templateDilated: Mask, copy: Mask, r: Rect, a: { dx: number; dy: number }): { ratio: number; pixels: number } {
  let added = 0
  let t = 0
  const x0 = Math.max(0, Math.round(r.x0)), x1 = Math.min(template.w, Math.round(r.x1))
  const y0 = Math.max(0, Math.round(r.y0)), y1 = Math.min(template.h, Math.round(r.y1))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      t++
      if (templateDilated.bits[y * template.w + x]) continue
      const xx = x + a.dx, yy = y + a.dy
      if (xx >= 0 && xx < copy.w && yy >= 0 && yy < copy.h && copy.bits[yy * copy.w + xx]) added++
    }
  }
  return { ratio: t ? added / t : 0, pixels: added }
}

/** A field counts as filled with at least this much added ink. */
export const FILLED_MIN_PIXELS = 18
export const FILLED_MIN_RATIO = 0.006

export function isFilled(ink: { ratio: number; pixels: number }): boolean {
  return ink.pixels >= FILLED_MIN_PIXELS && ink.ratio >= FILLED_MIN_RATIO
}

/** 1 bit per pixel, for storage. */
export function packMask(m: Mask): Uint8Array {
  const out = new Uint8Array(Math.ceil(m.bits.length / 8))
  for (let i = 0; i < m.bits.length; i++) if (m.bits[i]) out[i >> 3] |= 1 << (i & 7)
  return out
}

export function unpackMask(packed: Uint8Array, w: number, h: number): Mask {
  const bits = new Uint8Array(w * h)
  for (let i = 0; i < bits.length; i++) bits[i] = (packed[i >> 3] >> (i & 7)) & 1
  return { w, h, bits }
}

/** Pixels that are ink in at least `share` of the masks (a learned blank from filled copies). */
export function consensus(masks: Mask[], share: number): Mask {
  const { w, h } = masks[0]
  const counts = new Uint16Array(w * h)
  for (const m of masks) for (let i = 0; i < counts.length; i++) counts[i] += m.bits[i]
  const need = Math.max(1, Math.ceil(masks.length * share))
  const bits = new Uint8Array(w * h)
  for (let i = 0; i < bits.length; i++) bits[i] = counts[i] >= need ? 1 : 0
  return { w, h, bits }
}

/** Shift a mask by (dx, dy) into the template's frame (for learning from aligned copies). */
export function shifted(m: Mask, dx: number, dy: number, w = m.w, h = m.h): Mask {
  const bits = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const yy = y + dy
    if (yy < 0 || yy >= m.h) continue
    for (let x = 0; x < w; x++) {
      const xx = x + dx
      if (xx >= 0 && xx < m.w) bits[y * w + x] = m.bits[yy * m.w + xx]
    }
  }
  return { w, h, bits }
}
