/**
 * What a form page asks for, read from the printed form itself: which form
 * and release it is (the footer), where each party signs and dates, whether
 * the form marks that line as required, and where the page is initialed.
 *
 * Two printed styles cover the forms the Vault holds:
 *  - OREF: "Seller ______________ Date/Time ________ ←" on one line, and a
 *    legend "LINES WITH THIS SYMBOL ← REQUIRE A SIGNATURE AND DATE". The ←
 *    is a glyph in a symbol font, so it is found by the legend's font.
 *  - Oregon REALTORS®: a drawn rule with small labels under it
 *    ("Buyer's Signature … Date & Time").
 * When the blank carries form fields (tc_form_versions.field_map), their
 * boxes are the exact places to look; the printed labels say whose they are.
 *
 * Pure: text items (from pdfjs, top-left origin, scale 1) in, layout out.
 */
import type { Rect } from './raster'

export type TextItem = { str: string; x: number; y: number; w: number; h: number; font: string }
export type Party = 'buyer' | 'seller' | 'buyer_agent' | 'seller_agent' | 'principal_broker' | 'escrow' | 'other'

export type FooterId = {
  family: 'OREF' | 'OR' | 'other'
  number: string | null
  release: string | null
  page: number | null
  of: number | null
  raw: string
}

export type SignatureSlot = {
  party: Party
  label: string
  /** The heading the line sits under ("51. SELLER'S RESPONSE"), when the form has one. */
  section: string | null
  /** The form marks this line as requiring a signature and date (OREF ←). Null when the form has no such marker. */
  required: boolean | null
  sig: Rect
  date: Rect | null
  print: Rect | null
}

export type InitialsSlot = { party: Party; rects: Rect[] }

export type PageLayout = {
  footer: FooterId | null
  signatures: SignatureSlot[]
  initials: InitialsSlot[]
}

export type FieldBox = { page: number; x: number; y: number; w: number; h: number; type?: string }

// Helvetica advance widths (1/1000 em) for ASCII; forms are set in Helvetica
// or Arial, whose metrics match. Used to place characters inside one text run.
const HELV: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278,
  ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '{': 334, '|': 260, '}': 334, '~': 584, '’': 222, '‘': 222,
}
const charWidth = (c: string) => HELV[c] ?? (/[0-9]/.test(c) ? 556 : 556)

type Glyph = { c: string; x0: number; x1: number; font: string; item: number }

/**
 * A run with no readable text: an empty string, or only private-use / arrow
 * glyphs (pdfjs maps the OREF ← to U+F0DF-style private-use code points).
 */
export function isSymbolOnly(str: string): boolean {
  return !str.trim() || /^[\s\uE000-\uF8FF\u2190-\u21FF\u25A0-\u25FF\u2794-\u27BF]+$/.test(str)
}
export type Line = { y: number; h: number; glyphs: Glyph[]; text: string; items: TextItem[] }

/** Items on one baseline (±2.5 px) joined into a line with a position for every character. */
export function linesOf(items: TextItem[]): Line[] {
  const sorted = items.filter((i) => i.w > 0 || i.str).slice().sort((a, b) => a.y - b.y || a.x - b.x)
  const groups: TextItem[][] = []
  for (const it of sorted) {
    const g = groups.find((grp) => Math.abs(grp[0].y - it.y) <= 2.5)
    if (g) g.push(it)
    else groups.push([it])
  }
  return groups
    .map((grp) => {
      grp.sort((a, b) => a.x - b.x)
      const glyphs: Glyph[] = []
      grp.forEach((it, idx) => {
        const prev = glyphs[glyphs.length - 1]
        if (prev && it.x - prev.x1 > 1.2) glyphs.push({ c: ' ', x0: prev.x1, x1: it.x, font: it.font, item: -1 })
        if (it.str && !it.str.trim()) {
          // A spacing run: a space, not a marker.
          glyphs.push({ c: ' ', x0: it.x, x1: it.x + it.w, font: it.font, item: idx })
          return
        }
        if (!it.str && it.w <= 0.5) return
        const chars = isSymbolOnly(it.str) ? [] : [...it.str]
        if (!chars.length) {
          // A glyph pdfjs cannot map to text (the OREF ← marker): keep its place.
          glyphs.push({ c: '\u0000', x0: it.x, x1: it.x + it.w, font: it.font, item: idx })
          return
        }
        const total = chars.reduce((s, c) => s + charWidth(c), 0) || 1
        let x = it.x
        for (const c of chars) {
          const cw = (charWidth(c) / total) * it.w
          glyphs.push({ c, x0: x, x1: x + cw, font: it.font, item: idx })
          x += cw
        }
      })
      return { y: grp[0].y, h: Math.max(...grp.map((i) => i.h || 9)), glyphs, text: glyphs.map((g) => g.c).join(''), items: grp }
    })
    .sort((a, b) => a.y - b.y)
}

/**
 * Whether a page's text layer is real text. Flattened prints (zipForm /
 * Lone Wolf, some DigiSign exports) carry a text layer of re-mapped glyphs
 * ("!\" # $ $ % !&'"): useless for reading, so the page is read from its
 * image instead.
 */
export function textUsable(text: string): boolean {
  const chars = text.replace(/\s+/g, '')
  if (chars.length < 40) return false
  const letters = (chars.match(/[A-Za-z]/g) ?? []).length
  const words = (text.toLowerCase().match(/\b(the|and|of|to|or|seller|buyer|property|agreement|date|page|in|for|this)\b/g) ?? []).length
  return letters / chars.length >= 0.55 && words >= 3
}

/** Lines whose baselines are within tol points, joined left to right. */
export function mergeNear(lines: Line[], tol: number): Line[] {
  const out: Line[] = []
  for (const l of [...lines].sort((a, b) => a.y - b.y)) {
    const prev = out[out.length - 1]
    if (prev && l.y - prev.y <= tol) {
      const glyphs = [...prev.glyphs, ...l.glyphs].sort((a, b) => a.x0 - b.x0)
      const joined: Glyph[] = []
      for (const g of glyphs) {
        const last = joined[joined.length - 1]
        if (last && g.c !== ' ' && last.c !== ' ' && g.x0 - last.x1 > 1.2) joined.push({ c: ' ', x0: last.x1, x1: g.x0, font: g.font, item: -1 })
        joined.push(g)
      }
      out[out.length - 1] = { y: prev.y, h: Math.max(prev.h, l.h), glyphs: joined, text: joined.map((g) => g.c).join(''), items: [...prev.items, ...l.items] }
    } else out.push(l)
  }
  return out
}

const OREF_FOOTER = /OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released\s*(\d{1,2}\/\d{4})\s*\|\s*Page\s*(\d+)\s*of\s*(\d+)/i
const OR_VERSION = /Version\s*(\d{4}(?:\s*-\s*\d+)?)/i
const OR_FORM = /\bForm\s*(\d+(?:\.\d+)*[A-Z]?)\b/
const PAGE_OF = /Page\s*(\d+)\s*of\s*(\d+)/i

/** The form, release and page the footer prints. */
export function footerOf(lines: Line[], pageHeight = 792): FooterId | null {
  // Footer digits are often set in another font on a baseline a few points
  // off ("OREF 020 | Released 0 1 /20 2 6"): rejoin lines within 5 pt.
  const bottom = mergeNear(lines.filter((l) => l.y > pageHeight * 0.82), 5)
  for (const l of bottom) {
    const m = l.text.match(OREF_FOOTER)
    if (m) return { family: 'OREF', number: m[1].toUpperCase(), release: m[2], page: Number(m[3]), of: Number(m[4]), raw: m[0] }
  }
  const joined = bottom.map((l) => l.text).join(' ')
  if (/Oregon REALTORS/i.test(joined)) {
    const v = joined.match(OR_VERSION)
    const f = joined.match(OR_FORM)
    const p = joined.match(PAGE_OF)
    return {
      family: 'OR',
      number: f?.[1] ?? null,
      release: v ? v[1].replace(/\s+/g, '') : null,
      page: p ? Number(p[1]) : null,
      of: p ? Number(p[2]) : null,
      raw: bottom
        .map((l) => l.text.replace(/\u0000/g, '').trim())
        .filter((t) => /Version|Page\s*\d|Form\s*\d/i.test(t))
        .slice(0, 2)
        .join(' | ')
        .slice(0, 200),
    }
  }
  return null
}

export function partyOfLabel(raw: string): Party | null {
  const s = raw
    .replace(/[’‘]/g, "'")
    .replace(/^[\d.\s]+/, '')
    .replace(/signature|sign here|\(s\)|:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!s) return null
  if (/principal broker/.test(s)) return 'principal_broker'
  if (/^(buyer'?s?|purchaser'?s?) (agent|broker|licensee)$/.test(s)) return 'buyer_agent'
  if (/^(seller'?s?|owner'?s?|listing) (agent|broker|licensee)$/.test(s)) return 'seller_agent'
  if (/^(buyer|purchaser|buyers|purchasers|buyer's)$/.test(s)) return 'buyer'
  if (/^(seller|owner|sellers|owners|seller's)$/.test(s)) return 'seller'
  if (/^escrow( agent| officer)?$/.test(s)) return 'escrow'
  return null
}

/** The heading a line sits under: "51. SELLER'S RESPONSE", "7. Signatures". */
function sectionAbove(lines: Line[], y: number): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.y >= y - 1) continue
    // Drop the printed line number in the margin ("564 50. OFFER TO PURCHASE").
    const t = l.text.replace(/\u0000/g, '').trim().replace(/^\d{1,4}\s+(?=\d|[A-Z])/, '')
    const m = t.match(/^(\d+(?:\.\d+)*\.?\s+[A-Z][A-Z'’&/\s-]{3,}?)(?::|\s{2,}|$)/) ?? t.match(/^(\d+\.\s+Signatures)\b/i) ?? t.match(/^(SIGNATURES[A-Z\s]*)$/)
    if (m) return m[1].trim().replace(/\s+/g, ' ')
    // A boxed heading in capitals ("FINAL AGENCY ACKNOWLEDGMENT").
    const caps = t.replace(/[^A-Za-z]/g, '')
    if (caps.length >= 10 && t.length <= 60 && caps === caps.toUpperCase() && !/^(RESIDENTIAL|COMMERCIAL|PAGE)/.test(t)) return t.replace(/\s+/g, ' ')
  }
  return null
}

type Run = { label: string; x0: number; x1: number }

/** "Label ______" pieces of a line, in order. */
function underscoreRuns(line: Line): Run[] {
  const out: Run[] = []
  const re = /_{3,}/g
  let m: RegExpExecArray | null
  let prevEnd = 0
  while ((m = re.exec(line.text))) {
    // Printed line numbers ("211 Seller") are not part of the label.
    const label = line.text
      .slice(prevEnd, m.index)
      .replace(/\u0000/g, '')
      .trim()
      .replace(/^\d+\s+/, '')
    const g0 = line.glyphs[m.index]
    const g1 = line.glyphs[m.index + m[0].length - 1]
    out.push({ label, x0: g0.x0, x1: g1.x1 })
    prevEnd = m.index + m[0].length
  }
  return out
}

/**
 * The font of the ← glyph, taken from the legend "LINES WITH THIS SYMBOL ←
 * REQUIRE A SIGNATURE AND DATE": the text-less item just right of the legend
 * words. Symbol glyphs sit on their own baseline, so the search allows ±8 px.
 */
export function markerFontOf(items: TextItem[]): string | null {
  const legend = items.find((i) => /LINES WITH THIS SYMBOL/i.test(i.str))
  if (!legend) return null
  const right = legend.x + legend.w
  const cand = items
    .filter((i) => isSymbolOnly(i.str) && !/^ +$/.test(i.str) && i.w > 3 && i.w < 20 && Math.abs(i.y - legend.y) <= 8 && i.x >= right - 2 && i.x - right < 30)
    .sort((a, b) => a.x - b.x)[0]
  return cand?.font ?? null
}

/** x of every ← on a signature line: text-less items in the legend's font near the line's baseline. */
function markersNear(items: TextItem[], y: number, markerFont: string | null): number[] {
  if (!markerFont) return []
  return items.filter((i) => i.font === markerFont && isSymbolOnly(i.str) && !/^ +$/.test(i.str) && i.w > 3 && Math.abs(i.y - y) <= 8).map((i) => i.x).sort((a, b) => a - b)
}

const SIG_ABOVE = 20
const SIG_BELOW = 5

/**
 * The page's signature lines and initials boxes. `fields` (the blank's form
 * fields, normalized 0-1 like tc_form_versions.field_map) sharpen the boxes
 * when present.
 */
export function layoutOf(items: TextItem[], opts: { width: number; height: number; fields?: FieldBox[] } = { width: 612, height: 792 }): PageLayout {
  const lines = linesOf(items)
  const footer = footerOf(lines, opts.height)
  const markerFont = markerFontOf(items)
  const signatures: SignatureSlot[] = []
  const initials: InitialsSlot[] = []
  const fieldRects = (opts.fields ?? []).map((f) => ({ x0: f.x * opts.width, y0: f.y * opts.height, x1: (f.x + f.w) * opts.width, y1: (f.y + f.h) * opts.height }))
  // A form field on the blank is the exact box; take the one that overlaps
  // the box the printed text implies the most, if it overlaps enough.
  const snap = (guess: Rect): Rect => {
    let best: Rect | null = null
    let bestArea = 0
    for (const r of fieldRects) {
      const ox = Math.min(r.x1, guess.x1) - Math.max(r.x0, guess.x0)
      const oy = Math.min(r.y1, guess.y1) - Math.max(r.y0, guess.y0)
      if (ox <= 0 || oy <= 0) continue
      const area = ox * oy
      const need = 0.4 * Math.min((r.x1 - r.x0) * (r.y1 - r.y0), (guess.x1 - guess.x0) * (guess.y1 - guess.y0))
      if (area >= need && area > bestArea) {
        best = r
        bestArea = area
      }
    }
    return best ?? guess
  }

  lines.forEach((line, li) => {
    // Initials: "Seller Initials ____ / ____ / ____"
    const init = line.text.match(/(Buyer|Seller|Purchaser|Owner)['’]?s?\s+Initials/gi)
    if (init) {
      const runs = underscoreRuns(line)
      let current: InitialsSlot | null = null
      for (const r of runs) {
        const p = r.label.match(/(Buyer|Seller|Purchaser|Owner)['’]?s?\s+Initials/i)
        if (p) {
          current = { party: partyOfLabel(p[1]) ?? 'other', rects: [] }
          initials.push(current)
        } else if (!/^\/?$/.test(r.label)) {
          current = null
        }
        if (current) current.rects.push({ x0: r.x0, y0: line.y - 14, x1: r.x1, y1: line.y + 3 })
      }
      return
    }

    // OREF style: "Seller ______ Date/Time ______ ←"
    const runs = underscoreRuns(line)
    if (runs.length) {
      const markers = markersNear(items, line.y, markerFont)
      let open: SignatureSlot | null = null
      let lastMarker = -Infinity
      for (const r of runs) {
        const party = partyOfLabel(r.label)
        if (party) {
          const next = runs[runs.indexOf(r) + 1]
          const dated = next && /^date/i.test(next.label)
          const marker = markers.find((m) => m > r.x1 - 2 && m > lastMarker)
          if (!dated && marker === undefined) {
            open = null
            continue
          }
          open = {
            party,
            label: r.label.replace(/[’]/g, "'"),
            section: sectionAbove(lines, line.y),
            required: markerFont ? marker !== undefined : null,
            sig: snap({ x0: r.x0, y0: line.y - SIG_ABOVE, x1: r.x1, y1: line.y + SIG_BELOW }),
            date: null,
            print: null,
          }
          if (marker !== undefined) lastMarker = marker
          signatures.push(open)
        } else if (open && /^date/i.test(r.label)) {
          open.date = snap({ x0: r.x0, y0: line.y - 14, x1: r.x1, y1: line.y + 4 })
        } else if (/^print/i.test(r.label)) {
          // "Print ____" under the signature line it names.
          const above = [...signatures].reverse().find((s) => !s.print && s.sig.y1 < line.y && line.y - s.sig.y1 < 24 && Math.abs(s.sig.x0 - r.x0) < 60)
          if (above) above.print = snap({ x0: r.x0, y0: line.y - 12, x1: r.x1, y1: line.y + 3 })
        } else {
          open = null
        }
      }
      return
    }

    // Oregon REALTORS® style: label under a drawn rule.
    const m = line.text.match(/^\s*(?:\d+\s+)?((?:Buyer|Seller|Purchaser|Owner)['’]?s?(?:\s+(?:Agent|Broker))?)\s*Signature/i)
    if (m) {
      const party = partyOfLabel(m[1])
      if (!party) return
      const start = line.glyphs[line.text.indexOf(m[1])]?.x0 ?? line.glyphs[0].x0
      const dateIdx = line.text.search(/\bDate\b/)
      const dateX = dateIdx >= 0 ? line.glyphs[dateIdx].x0 : opts.width - 40
      const prevLine = lines[li - 1]
      const top = Math.max(prevLine ? prevLine.y + 3 : line.y - 26, line.y - 26)
      signatures.push({
        party,
        label: m[1].replace(/[’]/g, "'"),
        section: sectionAbove(lines, line.y),
        required: null,
        sig: snap({ x0: start, y0: top, x1: dateX - 4, y1: line.y - 7 }),
        date: dateIdx >= 0 ? snap({ x0: dateX, y0: top, x1: opts.width - 36, y1: line.y - 7 }) : null,
        print: null,
      })
    }
  })
  return { footer, signatures, initials }
}
