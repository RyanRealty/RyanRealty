/**
 * Check one stored document against the form templates and record it in
 * tc_document_checks. Cheap (no model calls): render each page at 1 px per
 * point, line it up with the nearest template pages, then look inside every
 * signature, date and initials box the matched form prints.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { dilate, type Mask } from './raster'
import { footerOf, linesOf, textUsable, type FooterId, type Party } from './layout'
import { CHECKER_VERSION, candidatesFor, checkInstance, describeCheck, explainMissing, instancesOf, matchPage, resolveTies, type Candidate, type FormCheck, type LoadedPage, type PageMatch } from './check'
import { loadTemplatePages, loadTemplates } from './templates'
import { openRaster } from './pdf-raster'

export type PageRecord = PageMatch & { footer: FooterId | null; textUsable: boolean }
export type DocumentCheck = { pages: PageRecord[]; forms: FormCheck[] }

const MAX_PAGES = 120

export async function checkPdfBytes(sb: SupabaseClient, bytes: Uint8Array | ArrayBuffer): Promise<DocumentCheck> {
  const templates = await loadTemplates(sb)
  const all: Candidate[] = templates.flatMap((t) => t.pages.map((page) => ({ template: t, page })))
  const byId = new Map(templates.map((t) => [t.id, t]))
  const pdf = await openRaster(bytes)
  const masks = new Map<number, Mask>()
  const pages: PageRecord[] = []
  try {
    const n = Math.min(pdf.pageCount, MAX_PAGES)
    for (let p = 1; p <= n; p++) {
      const mask = await pdf.mask(p)
      masks.set(p, mask)
      const lines = linesOf(await pdf.items(p))
      const usable = textUsable(lines.map((l) => l.text).join(' '))
      const footer = usable ? footerOf(lines, mask.h) : null
      const cands = candidatesFor(mask, all, 8, footer)
      const loaded: LoadedPage[] = []
      for (const c of cands) {
        const tp = await loadTemplatePages(sb, c.template)
        const lp = tp?.find((x) => x.page.page === c.page.page)
        if (lp) loaded.push(lp)
      }
      const m = matchPage(mask, dilate(mask, 1), loaded, p, footer)
      pages.push({ ...m, footer, textUsable: usable })
    }
  } finally {
    await pdf.close()
  }
  const resolved = resolveTies(pages) as PageRecord[]
  pages.splice(0, pages.length, ...resolved)
  const forms: FormCheck[] = []
  for (const inst of instancesOf(pages)) {
    const t = byId.get(inst.templateId)
    if (!t) continue
    const tp = await loadTemplatePages(sb, t)
    if (!tp) continue
    forms.push(
      checkInstance(
        t,
        inst.pages,
        (n) => tp.find((x) => x.page.page === n) ?? null,
        (d) => masks.get(d)!,
      ),
    )
  }
  return { pages, forms: explainMissing(forms, pages) }
}

export type StoredFormCheck = {
  form: string
  release: string | null
  source: 'library' | 'learned'
  pages: string
  missing: number[]
  complete: boolean
  issues: string[]
  notes: string[]
  signed: string[]
  initials: string | null
}

/** What the deal page shows: per form checked, pages present and who signed, or what is missing. */
export function summarizeChecks(check: DocumentCheck, named: Partial<Record<Party, number>> = {}): { version: string; forms: StoredFormCheck[]; unmatchedPages: number; pages: number } {
  const forms = check.forms.map((f) => {
    const d = describeCheck(f, named)
    const present = f.pages.filter((p) => p.docPage != null).length
    const signedParties = [...new Set(f.lines.filter((l) => l.signed).map((l) => l.party))]
    const initialPages = f.initials.filter((i) => i.slots.some(Boolean))
    const initialsNote = f.initials.length
      ? initialPages.length === f.initials.length
        ? 'initialed on every page it asks'
        : `initials missing on page ${[...new Set(f.initials.filter((i) => !i.slots.some(Boolean)).map((i) => i.page))].join(', ')}`
      : null
    return {
      form: `${f.family === 'OR' ? 'Form' : f.family} ${f.formNumber}`,
      release: f.release,
      source: f.source,
      pages: `${present} of ${f.pageCount}`,
      missing: f.missingPages,
      complete: d.complete,
      issues: d.issues,
      notes: d.notes,
      signed: signedParties,
      initials: initialsNote,
    }
  })
  return { version: CHECKER_VERSION, forms, unmatchedPages: check.pages.filter((p) => !p.templateId).length, pages: check.pages.length }
}

async function recordOnDocument(sb: SupabaseClient, documentId: string, check: DocumentCheck): Promise<void> {
  const { data: doc } = await sb.from('tc_documents').select('classification').eq('id', documentId).maybeSingle()
  const classification = { ...((doc?.classification as Record<string, unknown> | null) ?? {}), form_check: summarizeChecks(check) }
  await sb.from('tc_documents').update({ classification }).eq('id', documentId)
}

export async function checkStoredDocument(sb: SupabaseClient, documentId: string): Promise<{ ok: true; check: DocumentCheck } | { ok: false; error: string }> {
  const t0 = Date.now()
  const { data: doc } = await sb.from('tc_documents').select('id, storage_path, sha256, page_count').eq('id', documentId).maybeSingle()
  if (!doc?.storage_path) return { ok: false, error: 'document has no stored file' }
  const { data: blob, error } = await sb.storage.from('tc-documents').download(String(doc.storage_path))
  if (error || !blob) return { ok: false, error: `download: ${error?.message ?? 'missing'}` }
  try {
    const check = await checkPdfBytes(sb, await blob.arrayBuffer())
    await sb.from('tc_document_checks').upsert(
      {
        document_id: documentId,
        checker_version: CHECKER_VERSION,
        sha256: doc.sha256 ?? null,
        page_count: check.pages.length,
        pages: check.pages,
        forms: check.forms,
        duration_ms: Date.now() - t0,
        error: null,
      },
      { onConflict: 'document_id,checker_version' },
    )
    await recordOnDocument(sb, documentId, check)
    return { ok: true, check }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await sb.from('tc_document_checks').upsert(
      { document_id: documentId, checker_version: CHECKER_VERSION, sha256: doc.sha256 ?? null, duration_ms: Date.now() - t0, error: msg.slice(0, 500) },
      { onConflict: 'document_id,checker_version' },
    )
    return { ok: false, error: msg }
  }
}

/** Live PDFs the current checker has not checked, oldest first. */
export async function uncheckedDocumentIds(sb: SupabaseClient, limit: number): Promise<string[]> {
  const done = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('tc_document_checks').select('document_id').eq('checker_version', CHECKER_VERSION).range(from, from + 999)
    for (const d of data ?? []) done.add(String(d.document_id))
    if (!data || data.length < 1000) break
  }
  const out: string[] = []
  for (let from = 0; out.length < limit; from += 1000) {
    const { data } = await sb
      .from('tc_documents')
      .select('id')
      .eq('archived', false)
      .eq('is_broker_notes', false)
      .or('content_type.eq.application/pdf,content_type.is.null')
      .not('storage_path', 'is', null)
      .order('ingested_at', { ascending: true })
      .range(from, from + 999)
    if (!data?.length) break
    for (const d of data) if (!done.has(String(d.id)) && out.length < limit) out.push(String(d.id))
    if (data.length < 1000) break
  }
  return out
}

/** Documents to check again because a template for their pages now exists. */
export async function recheckDocuments(sb: SupabaseClient, documentIds: readonly string[]): Promise<void> {
  for (let i = 0; i < documentIds.length; i += 200) {
    await sb.from('tc_document_checks').delete().eq('checker_version', CHECKER_VERSION).in('document_id', documentIds.slice(i, i + 200))
  }
}
