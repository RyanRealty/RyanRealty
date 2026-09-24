/**
 * Match a document's pages to form templates and check each form it holds:
 * every page present, every signature line signed and dated, every initials
 * box initialed. Pure: masks and templates in, findings out.
 *
 * A template page is the printed form alone (a licensed blank from the
 * library, or learned from our own copies of a release the library does not
 * hold). A copy of the same release carries all of its ink; what the copy
 * adds inside a signature box is the signature.
 */
import { addedInk, align, descriptor, descriptorGap, dilate, inkPoints, isFilled, type Mask, type Rect } from './raster'
import type { FooterId, InitialsSlot, Party, SignatureSlot } from './layout'

export const CHECKER_VERSION = 'form-check-v1-2026-09-24'

/** A copy lines up with its own release at ≥ 0.97 (measured 1.000); other releases and forms stay under 0.70. */
export const MATCH_MIN = 0.9
/** Below this the page is not from any template we hold; between the two it is reported as the nearest, not matched. */
export const NEAR_MIN = 0.6

export type TemplatePage = {
  page: number
  w: number
  h: number
  footer: FooterId | null
  descriptor: Uint8Array
  signatures: SignatureSlot[]
  initials: InitialsSlot[]
}

export type TemplateInfo = {
  id: string
  family: string
  formNumber: string
  release: string | null
  edition: string
  title: string
  pageCount: number
  source: 'library' | 'learned'
  pages: TemplatePage[]
}

export type LoadedPage = { template: TemplateInfo; page: TemplatePage; mask: Mask; points: Int32Array; dilated: () => Mask }

export type PageMatch = {
  page: number
  templateId: string | null
  templatePage: number | null
  coverage: number
  dx: number
  dy: number
  /** The closest template when none matched: "OREF 003 01/2026 p1 at 48%". */
  nearest: { templateId: string; templatePage: number; coverage: number } | null
}

export type LineFinding = {
  page: number
  party: Party
  label: string
  section: string | null
  required: boolean | null
  signed: boolean
  dated: boolean | null
  printed: boolean | null
  ink: number
}

export type InitialsFinding = { page: number; party: Party; slots: boolean[] }

export type FormCheck = {
  templateId: string
  family: string
  formNumber: string
  release: string | null
  title: string
  source: 'library' | 'learned'
  pageCount: number
  /** Document page for each template page, null when missing. */
  pages: Array<{ templatePage: number; docPage: number | null; coverage: number | null }>
  missingPages: number[]
  lines: LineFinding[]
  initials: InitialsFinding[]
}

export type Candidate = { template: TemplateInfo; page: TemplatePage }

/** The template pages worth lining up with a copy page, nearest first. */
export function candidatesFor(copy: Mask, all: Candidate[], limit = 6, footer?: FooterId | null): Candidate[] {
  const d = descriptor(copy)
  const sized = all.filter((c) => Math.abs(c.page.w - copy.w) <= 4 && Math.abs(c.page.h - copy.h) <= 4)
  const scored = sized.map((c) => {
    let gap = descriptorGap(c.page.descriptor, d)
    // A readable footer naming the same form, release and page is strong evidence; let it lead.
    if (footer?.number && c.page.footer?.number === footer.number && c.page.footer?.page === footer.page) {
      gap -= c.page.footer.release === footer.release ? 1 : 0.25
    }
    return { c, gap }
  })
  scored.sort((a, b) => a.gap - b.gap)
  return scored.slice(0, limit).map((s) => s.c)
}

export function matchPage(copy: Mask, copyDilated: Mask, loaded: LoadedPage[], pageNo: number): PageMatch {
  let best: { lp: LoadedPage; coverage: number; dx: number; dy: number } | null = null
  for (const lp of loaded) {
    const a = align(lp.points, lp.mask.w, copyDilated)
    if (!best || a.coverage > best.coverage) best = { lp, ...a }
    if (a.coverage >= 0.995) break
  }
  if (!best || best.coverage < NEAR_MIN) return { page: pageNo, templateId: null, templatePage: null, coverage: best?.coverage ?? 0, dx: 0, dy: 0, nearest: null }
  if (best.coverage < MATCH_MIN) {
    return {
      page: pageNo,
      templateId: null,
      templatePage: null,
      coverage: best.coverage,
      dx: best.dx,
      dy: best.dy,
      nearest: { templateId: best.lp.template.id, templatePage: best.lp.page.page, coverage: best.coverage },
    }
  }
  return { page: pageNo, templateId: best.lp.template.id, templatePage: best.lp.page.page, coverage: best.coverage, dx: best.dx, dy: best.dy, nearest: null }
}

/**
 * Split matched pages into form instances: one instance per run of a
 * template's pages; a template page seen again starts the next copy (two
 * counteroffers on the same form in one PDF).
 */
export function instancesOf(matches: PageMatch[]): Array<{ templateId: string; pages: PageMatch[] }> {
  const out: Array<{ templateId: string; pages: PageMatch[] }> = []
  const open = new Map<string, { templateId: string; pages: PageMatch[] }>()
  for (const m of matches) {
    if (!m.templateId || m.templatePage == null) continue
    let inst = open.get(m.templateId)
    if (!inst || inst.pages.some((p) => p.templatePage === m.templatePage)) {
      inst = { templateId: m.templateId, pages: [] }
      out.push(inst)
      open.set(m.templateId, inst)
    }
    inst.pages.push(m)
  }
  return out
}

function filled(tpl: LoadedPage, copy: Mask, r: Rect | null, a: { dx: number; dy: number }): { yes: boolean; ink: number } | null {
  if (!r) return null
  const ink = addedInk(tpl.mask, tpl.dilated(), copy, r, a)
  return { yes: isFilled(ink), ink: ink.pixels }
}

export function checkInstance(
  template: TemplateInfo,
  pages: PageMatch[],
  loadedPage: (templatePage: number) => LoadedPage | null,
  copyMask: (docPage: number) => Mask,
): FormCheck {
  const byTplPage = new Map(pages.map((p) => [p.templatePage!, p]))
  const lines: LineFinding[] = []
  const initials: InitialsFinding[] = []
  for (const tp of template.pages) {
    const m = byTplPage.get(tp.page)
    if (!m) continue
    const lp = loadedPage(tp.page)
    if (!lp) continue
    const copy = copyMask(m.page)
    const a = { dx: m.dx, dy: m.dy }
    for (const s of tp.signatures) {
      const sig = filled(lp, copy, s.sig, a)!
      const date = filled(lp, copy, s.date, a)
      const print = filled(lp, copy, s.print, a)
      lines.push({
        page: tp.page,
        party: s.party,
        label: s.label,
        section: s.section,
        required: s.required,
        signed: sig.yes,
        dated: date ? date.yes : null,
        printed: print ? print.yes : null,
        ink: sig.ink,
      })
    }
    for (const i of tp.initials) {
      initials.push({ page: tp.page, party: i.party, slots: i.rects.map((r) => filled(lp, copy, r, a)!.yes) })
    }
  }
  const pageList = template.pages.map((tp) => {
    const m = byTplPage.get(tp.page)
    return { templatePage: tp.page, docPage: m ? m.page : null, coverage: m ? Math.round(m.coverage * 1000) / 1000 : null }
  })
  return {
    templateId: template.id,
    family: template.family,
    formNumber: template.formNumber,
    release: template.release,
    title: template.title,
    source: template.source,
    pageCount: template.pageCount,
    pages: pageList,
    missingPages: pageList.filter((p) => p.docPage == null).map((p) => p.templatePage),
    lines,
    initials,
  }
}

/** Precompute what lining up needs for one template page. */
export function loadPage(template: TemplateInfo, page: TemplatePage, mask: Mask): LoadedPage {
  let grown: Mask | null = null
  return { template, page, mask, points: inkPoints(mask, 3), dilated: () => (grown ??= dilate(mask, 1)) }
}

/** Plain-words summary of one form check, for the review list and the file view. */
export function describeCheck(c: FormCheck, named: Partial<Record<Party, number>> = {}): { complete: boolean; issues: string[] } {
  const issues: string[] = []
  if (c.missingPages.length) issues.push(`missing page${c.missingPages.length > 1 ? 's' : ''} ${c.missingPages.join(', ')} of ${c.pageCount}`)
  const parties = new Set(c.lines.filter((l) => l.required !== false).map((l) => l.party))
  for (const party of parties) {
    const req = c.lines.filter((l) => l.party === party && l.required !== false)
    const signed = req.filter((l) => l.signed).length
    const need = Math.max(1, named[party] ?? 1)
    // A section's lines are one signing (the seller's response); count the busiest section.
    const bySection = new Map<string, number>()
    for (const l of req) if (l.signed) bySection.set(l.section ?? '', (bySection.get(l.section ?? '') ?? 0) + 1)
    const most = Math.max(0, ...bySection.values())
    if (signed === 0) issues.push(`${party.replace('_', ' ')} has not signed`)
    else if (most < need) issues.push(`${need} ${party.replace('_', ' ')}${need > 1 ? 's' : ''} named, ${most} signed`)
    const undated = req.filter((l) => l.signed && l.dated === false).length
    if (undated) issues.push(`${undated} ${party.replace('_', ' ')} signature${undated > 1 ? 's' : ''} not dated`)
  }
  return { complete: issues.length === 0, issues }
}
