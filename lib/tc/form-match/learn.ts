/**
 * Learn templates for releases the library does not hold.
 *
 * The library keeps the current release of each form. Deals from earlier
 * years used earlier releases (OREF 003 Released 01/2025 is one page; the
 * 01/2026 release is two), and a new release can reach the Vault before the
 * library has it. Checking those copies against the current blank would be
 * wrong, so the Vault learns each release from its own copies: the ink every
 * copy of a page shares is the printed form, and the typed values and
 * signatures, which differ from deal to deal, drop out.
 *
 * Only copies from at least two different deals are used, so one deal's
 * duplicates (the same signed PDF sent twice) can never teach a signature as
 * part of the form. A page whose copies do not share ≥ 95% of the learned ink
 * is left out (a different printing of that release).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { align, consensus, descriptor, dilate, inkCount, inkPoints, shifted, type Mask } from './raster'
import { layoutOf, type FooterId } from './layout'
import { CHECKER_VERSION, type TemplatePage } from './check'
import { saveTemplate } from './templates'
import { openRaster, type RasterPdf } from './pdf-raster'

export type LearnCopy = { documentId: string; cycleId: string; docPage: number; footer: FooterId }

export type LearnResult = {
  learned: Array<{ key: string; pages: number[]; copies: number; deals: number }>
  skipped: Array<{ key: string; reason: string }>
}

const MIN_DEALS = 2
const MIN_COPIES = 2
const MEMBER_MIN = 0.95

/** Align copies to the lightest one and keep the ink they share. */
export function learnPage(masks: Mask[]): { template: Mask; members: number[] } | null {
  if (masks.length < MIN_COPIES) return null
  const order = masks.map((m, i) => ({ i, ink: inkCount(m) })).sort((a, b) => a.ink - b.ink)
  const ref = masks[order[0].i]
  const refPoints = inkPoints(ref, 3)
  const aligned: Array<{ i: number; mask: Mask }> = [{ i: order[0].i, mask: ref }]
  for (const { i } of order.slice(1)) {
    const m = masks[i]
    if (m.w !== ref.w || m.h !== ref.h) continue
    // The reference carries its own fill, so a good match of two filled copies is ~0.8-0.95.
    const a = align(refPoints, ref.w, dilate(m, 1), 24, 2, m)
    if (a.coverage < 0.7) continue
    aligned.push({ i, mask: shifted(m, a.dx, a.dy, ref.w, ref.h) })
  }
  if (aligned.length < MIN_COPIES) return null
  const share = aligned.length >= 5 ? 0.8 : 1
  // The reference's own fill can pull an alignment a pixel off. Line every
  // copy up again against the shared ink (fills gone) before the final merge.
  const rough = consensus(
    aligned.map((a) => a.mask),
    share,
  )
  const roughPts = inkPoints(rough, 2)
  const realigned = aligned.map(({ i }) => {
    const m = masks[i]
    const a = align(roughPts, rough.w, dilate(m, 1), 6, 1, m)
    return { i, mask: shifted(m, a.dx, a.dy, rough.w, rough.h) }
  })
  const first = consensus(
    realigned.map((a) => a.mask),
    share,
  )
  // Members: copies that carry nearly all of the shared ink.
  const pts = inkPoints(first, 2)
  const members = realigned.filter((a) => align(pts, first.w, dilate(a.mask, 1), 3, 1).coverage >= MEMBER_MIN)
  if (members.length < MIN_COPIES) return null
  const template = members.length === aligned.length ? first : consensus(members.map((m) => m.mask), members.length >= 5 ? 0.8 : 1)
  return { template, members: members.map((m) => m.i) }
}

function keyOf(f: FooterId): string {
  return `${f.family}|${f.number}|${f.release}|${f.of ?? ''}`
}

/**
 * Learn a template for every form + release that has readable copies from
 * at least two deals and no library template, from the pages the current
 * checker could not match.
 */
export async function learnTemplates(sb: SupabaseClient, opts: { log?: (s: string) => void; dryRun?: boolean } = {}): Promise<LearnResult> {
  const log = opts.log ?? (() => {})
  const checks: Array<{ document_id: string; pages: Array<{ page: number; templateId: string | null; footer: FooterId | null; textUsable: boolean }> }> = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from('tc_document_checks').select('document_id, pages').eq('checker_version', CHECKER_VERSION).is('error', null).range(from, from + 499)
    if (error) throw new Error(`tc_document_checks: ${error.message}`)
    checks.push(...((data ?? []) as typeof checks))
    if (!data || data.length < 500) break
  }
  const docIds = [...new Set(checks.map((c) => c.document_id))]
  const cycleOf = new Map<string, string>()
  const pathOf = new Map<string, string>()
  for (let i = 0; i < docIds.length; i += 300) {
    const { data } = await sb.from('tc_documents').select('id, cycle_id, storage_path').in('id', docIds.slice(i, i + 300))
    for (const d of data ?? []) {
      cycleOf.set(String(d.id), String(d.cycle_id))
      if (d.storage_path) pathOf.set(String(d.id), String(d.storage_path))
    }
  }
  const groups = new Map<string, Map<number, LearnCopy[]>>()
  for (const c of checks) {
    for (const p of c.pages ?? []) {
      if (p.templateId || !p.footer?.number || !p.footer.release || !p.footer.page) continue
      const key = keyOf(p.footer)
      const byPage = groups.get(key) ?? new Map<number, LearnCopy[]>()
      const list = byPage.get(p.footer.page) ?? []
      list.push({ documentId: c.document_id, cycleId: cycleOf.get(c.document_id) ?? c.document_id, docPage: p.page, footer: p.footer })
      byPage.set(p.footer.page, list)
      groups.set(key, byPage)
    }
  }
  const result: LearnResult = { learned: [], skipped: [] }
  // The licensed blank of a release always wins over a learned one.
  const { data: lib } = await sb.from('tc_form_templates').select('family, form_number, release').eq('source', 'library').eq('status', 'active')
  const licensed = new Set((lib ?? []).map((t) => `${t.family}|${t.form_number}|${t.release}`))
  const open = new Map<string, Promise<RasterPdf | null>>()
  const pdfOf = (id: string) => {
    let p = open.get(id)
    if (!p) {
      p = (async () => {
        const path = pathOf.get(id)
        if (!path) return null
        const { data } = await sb.storage.from('tc-documents').download(path)
        return data ? openRaster(await data.arrayBuffer()) : null
      })()
      open.set(id, p)
    }
    return p
  }
  try {
    for (const [key, byPage] of groups) {
      const [fam0, num0, rel0] = key.split('|')
      if (licensed.has(`${fam0}|${num0}|${rel0}`)) {
        result.skipped.push({ key, reason: 'licensed blank held; unmatched pages are scans or other printings' })
        continue
      }
      const deals = new Set([...byPage.values()].flat().map((c) => c.cycleId))
      if (deals.size < MIN_DEALS) {
        result.skipped.push({ key, reason: `copies from ${deals.size} deal` })
        continue
      }
      const [family, number, release, of] = key.split('|')
      const pageCount = Number(of) || Math.max(...byPage.keys())
      const pages: TemplatePage[] = []
      const masks: Mask[] = []
      let copies = 0
      for (const [pageNo, list] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
        // One copy per deal and document; never two copies from one document.
        const seen = new Set<string>()
        const use = list.filter((c) => !seen.has(c.documentId) && seen.add(c.documentId)).slice(0, 12)
        if (new Set(use.map((c) => c.cycleId)).size < MIN_DEALS) continue
        const pageMasks: Mask[] = []
        const sources: LearnCopy[] = []
        for (const c of use) {
          const pdf = await pdfOf(c.documentId)
          if (!pdf) continue
          pageMasks.push(await pdf.mask(c.docPage))
          sources.push(c)
        }
        const learned = learnPage(pageMasks)
        if (!learned) continue
        const memberDeals = new Set(learned.members.map((i) => sources[i].cycleId))
        if (memberDeals.size < MIN_DEALS) continue
        // What the page asks for, from a member copy's readable text.
        const ref = sources[learned.members[0]]
        const pdf = await pdfOf(ref.documentId)
        const layout = layoutOf(await pdf!.items(ref.docPage), { width: learned.template.w, height: learned.template.h })
        pages.push({
          page: pageNo,
          w: learned.template.w,
          h: learned.template.h,
          footer: ref.footer,
          descriptor: descriptor(learned.template),
          signatures: layout.signatures,
          initials: layout.initials,
        })
        masks.push(learned.template)
        copies = Math.max(copies, learned.members.length)
      }
      if (!pages.length) {
        result.skipped.push({ key, reason: 'no page with agreeing copies from two deals' })
        continue
      }
      const title = `${family} ${number} (Released ${release})`
      if (!opts.dryRun) {
        await saveTemplate(sb, { family, formNumber: number, release, edition: 'a', title, source: 'learned', formVersionId: null, copies, pages, masks })
      }
      result.learned.push({ key, pages: pages.map((p) => p.page), copies, deals: deals.size })
      log(`learned ${key}: pages ${pages.map((p) => p.page).join(',')} of ${pageCount}, ${copies} copies`)
    }
  } finally {
    for (const p of open.values()) (await p)?.close().catch(() => {})
  }
  return result
}
