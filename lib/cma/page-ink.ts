/**
 * Sheet-ink checks the page-safety contract does not cover.
 *
 * A section banner and its heading must not be the last ink on a sheet.
 * The body they introduce starts on the next sheet, which is how the
 * priced-right chapter was landing under the competition grid.
 */

import type { PdfTextRun } from '@/lib/pdf/assert-page-safety'
import { CMA_MARGIN_IN, PAPER, marginsToPt } from '@/lib/pdf/page-contract'

function isChrome(text: string): boolean {
  const t = text.trim()
  if (/^page\s+\d+\s+of\s+\d+$/i.test(t)) return true
  if (/^ryan realty/i.test(t) && /541/.test(t)) return true
  if (/^541[.\s]?703/.test(t)) return true
  return false
}

function letterRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length === 0) return 0
  return letters.replace(/[^A-Z]/g, '').length / letters.length
}

function isPgMeta(text: string): boolean {
  const t = text.trim()
  if (!t.includes('·')) return false
  return letterRatio(t) > 0.85 && t.replace(/[^A-Za-z]/g, '').length >= 8
}

function isLetterSpaced(text: string): boolean {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 5 && parts.every((p) => p.length <= 3)
}

/** A chapter heading, whether pdf.js kept the words or split the letter-spacing. */
export function isSectionHead(text: string): boolean {
  const t = text.trim()
  if (isChrome(t) || isPgMeta(t)) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length < 10) return false
  if (isLetterSpaced(t)) return true
  const words = t.replace(/[.^]/g, '').trim()
  return words === words.toUpperCase() && letterRatio(words) > 0.85 && letters.length >= 12
}

/** Ink that counts as the chapter body, including a price or a table cell. */
function isBodyInk(text: string): boolean {
  const t = text.trim()
  if (!t || isChrome(t) || isPgMeta(t) || isSectionHead(t)) return false
  if (/\$[\d,]|\d/.test(t)) return true
  return /[a-z]/i.test(t) && t.replace(/\s/g, '').length >= 8
}

/**
 * Pages whose last real ink is a heading or the section banner, with the
 * chapter body on the next sheet. Returns one string per failing sheet.
 */
export function headingTailFailures(
  pages: PdfTextRun[][],
  sizes: { w: number; h: number }[],
  label: string,
): string[] {
  const margins = marginsToPt(CMA_MARGIN_IN)
  const boxH = PAPER.heightPt - margins.top - margins.bottom
  const tailLine = margins.bottom + 0.3 * boxH
  const failures: string[] = []

  pages.forEach((all, idx) => {
    const pageNo = idx + 1
    if (pageNo === 1) return
    const body = all.filter((r) => !isChrome(r.text))
    const belowBanner = body.filter((r) => !isPgMeta(r.text))
    const heads = belowBanner.filter((r) => isSectionHead(r.text))
    const lowestHead = [...heads].sort((a, b) => a.y0 - b.y0)[0]

    if (lowestHead && lowestHead.y0 < tailLine) {
      const under = belowBanner.filter((r) => r.y1 < lowestHead.y0 - 2 && isBodyInk(r.text))
      if (under.length === 0) {
        failures.push(`${label} p${pageNo}: heading tail ("${lowestHead.text.slice(0, 48)}")`)
      }
    }

    const metas = body.filter((r) => isPgMeta(r.text))
    const lowestMeta = [...metas].sort((a, b) => a.y0 - b.y0)[0]
    if (!lowestMeta || lowestMeta.y0 >= tailLine) return
    const underMeta = belowBanner.filter((r) => r.y1 < lowestMeta.y0 - 2 && isBodyInk(r.text))
    const aboveMeta = belowBanner.filter((r) => r.y0 > lowestMeta.y1 + 2 && isBodyInk(r.text))
    if (underMeta.length === 0 && aboveMeta.length > 0) {
      failures.push(`${label} p${pageNo}: section banner tail ("${lowestMeta.text.slice(0, 48)}")`)
    }
  })

  return failures
}
