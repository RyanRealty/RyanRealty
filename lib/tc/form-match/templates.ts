/**
 * The template store: build templates from the licensed blanks in
 * tc_form_versions, save them (row + packed masks in the tc-forms bucket),
 * and load them for matching. See the migration
 * 20260924040000_tc_form_templates.sql for what a template is.
 */
import { gunzipSync, gzipSync } from 'node:zlib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { align, consensus, descriptor, dilate, inkPoints, packMask, unpackMask, type Mask } from './raster'
import { layoutOf, onRules, type FieldBox, type FooterId } from './layout'
import { loadPage, type LoadedPage, type TemplateInfo, type TemplatePage } from './check'
import { openRaster } from './pdf-raster'

export const TEMPLATE_BUILDER_VERSION = 'template-builder-v1-2026-09-24'
export const TEMPLATE_BUCKET = 'tc-forms'

type StoredPage = Omit<TemplatePage, 'descriptor'> & { descriptor: string }

export type TemplateRow = {
  id: string
  family: string
  form_number: string
  release: string | null
  edition: string
  title: string
  page_count: number
  source: 'library' | 'learned'
  form_version_id: string | null
  copies: number
  pages: StoredPage[]
  masks_path: string
  status: string
}

export function templateFromRow(r: TemplateRow): TemplateInfo {
  return {
    id: r.id,
    family: r.family,
    formNumber: r.form_number,
    release: r.release,
    edition: r.edition,
    title: r.title,
    pageCount: r.page_count,
    source: r.source,
    pages: (r.pages ?? []).map((p) => ({ ...p, descriptor: new Uint8Array(Buffer.from(p.descriptor, 'base64')) })),
  }
}

/** All page masks of a template in one gzip blob: [u16 w][u16 h][packed bits] per page. */
export function encodeMasks(masks: Mask[]): Buffer {
  const parts: Buffer[] = []
  for (const m of masks) {
    const head = Buffer.alloc(4)
    head.writeUInt16LE(m.w, 0)
    head.writeUInt16LE(m.h, 2)
    parts.push(head, Buffer.from(packMask(m)))
  }
  return gzipSync(Buffer.concat(parts))
}

export function decodeMasks(blob: Buffer): Mask[] {
  const raw = gunzipSync(blob)
  const out: Mask[] = []
  let o = 0
  while (o + 4 <= raw.length) {
    const w = raw.readUInt16LE(o)
    const h = raw.readUInt16LE(o + 2)
    o += 4
    const n = Math.ceil((w * h) / 8)
    out.push(unpackMask(new Uint8Array(raw.subarray(o, o + n)), w, h))
    o += n
  }
  return out
}

// ── loading ──────────────────────────────────────────────────────────────

const TTL_MS = 10 * 60 * 1000
let cachedTemplates: { at: number; list: Promise<TemplateInfo[]>; rows: Map<string, TemplateRow> } | null = null
const maskCache = new Map<string, Promise<LoadedPage[] | null>>()
const MASK_CACHE_MAX = 80

export function loadTemplates(sb: SupabaseClient, opts?: { fresh?: boolean }): Promise<TemplateInfo[]> {
  if (!opts?.fresh && cachedTemplates && Date.now() - cachedTemplates.at < TTL_MS) return cachedTemplates.list
  const rows = new Map<string, TemplateRow>()
  const list = (async () => {
    const out: TemplateInfo[] = []
    for (let from = 0; ; from += 500) {
      const { data, error } = await sb
        .from('tc_form_templates')
        .select('id, family, form_number, release, edition, title, page_count, source, form_version_id, copies, pages, masks_path, status')
        .eq('status', 'active')
        .range(from, from + 499)
      if (error) return out
      for (const r of (data ?? []) as TemplateRow[]) {
        rows.set(r.id, r)
        out.push(templateFromRow(r))
      }
      if (!data || data.length < 500) break
    }
    return out
  })()
  cachedTemplates = { at: Date.now(), list, rows }
  maskCache.clear()
  return list
}

/** A template's pages ready to line up (masks downloaded once per process). */
export function loadTemplatePages(sb: SupabaseClient, template: TemplateInfo): Promise<LoadedPage[] | null> {
  const hit = maskCache.get(template.id)
  if (hit) return hit
  const p = (async () => {
    const row = cachedTemplates?.rows.get(template.id)
    const path = row?.masks_path ?? `templates/${template.id}.bin`
    const { data, error } = await sb.storage.from(TEMPLATE_BUCKET).download(path)
    if (error || !data) return null
    const masks = decodeMasks(Buffer.from(await data.arrayBuffer()))
    return template.pages.map((pg, i) => loadPage(template, pg, masks[i]))
  })()
  if (maskCache.size >= MASK_CACHE_MAX) maskCache.delete(maskCache.keys().next().value as string)
  maskCache.set(template.id, p)
  return p
}

// ── building from the library ────────────────────────────────────────────

type VersionRow = {
  id: string
  library_id: string
  form_number: string | null
  name: string
  blank_pdf_storage_path: string | null
  sha256: string | null
  page_count: number | null
  field_map: FieldBox[] | null
  field_map_source: string | null
  superseded_by: string | null
  retired_at: string | null
}

export type BuiltPage = { page: TemplatePage; mask: Mask }

/** Render a blank and read what each page asks for. */
export async function buildPagesFromPdf(bytes: Uint8Array | ArrayBuffer, fields: FieldBox[] = []): Promise<BuiltPage[]> {
  const pdf = await openRaster(bytes)
  try {
    const out: BuiltPage[] = []
    for (let n = 1; n <= pdf.pageCount; n++) {
      const mask = await pdf.mask(n)
      const layout = layoutOf(await pdf.items(n), { width: mask.w, height: mask.h, fields: fields.filter((f) => f.page === n) })
      out.push({
        mask,
        page: { page: n, w: mask.w, h: mask.h, footer: layout.footer, descriptor: descriptor(mask), signatures: onRules(mask, layout.signatures), initials: layout.initials },
      })
    }
    return out
  } finally {
    await pdf.close()
  }
}

const SAMPLE = /\(SAMPLE\b/i

/** Two blanks are one printing when each carries ≥ 97% of the other's ink on every page. */
export function samePrinting(a: BuiltPage[], b: BuiltPage[]): boolean {
  if (a.length !== b.length) return false
  return a.every((pa, i) => {
    const pb = b[i]
    if (pa.mask.w !== pb.mask.w || pa.mask.h !== pb.mask.h) return false
    const ab = align(inkPoints(pa.mask, 3), pa.mask.w, dilate(pb.mask, 1), 6, 1).coverage
    const ba = align(inkPoints(pb.mask, 3), pb.mask.w, dilate(pa.mask, 1), 6, 1).coverage
    return ab >= 0.97 && ba >= 0.97
  })
}

/**
 * Identity of a library blank: the footer when it prints one (OREF 003 |
 * Released 01/2026), else the library's own number.
 */
export function identityOf(libraryCode: string, v: { form_number: string | null; name: string }, footer: FooterId | null): { family: string; formNumber: string; release: string | null } {
  const family = footer?.family && footer.family !== 'other' ? footer.family : libraryCode
  const formNumber = (footer?.number ?? v.form_number ?? v.name).trim()
  return { family, formNumber, release: footer?.release ?? null }
}

export type LibraryBuildResult = { templates: number; versions: number; skipped: Array<{ name: string; reason: string }> }

/**
 * One template per form + release from the licensed blanks. Blanks of one
 * release that differ only in a pre-filled number ("Seller's Counteroffer 1",
 * "… 2") are merged: the template keeps the ink they all share.
 */
export async function buildLibraryTemplates(sb: SupabaseClient, opts: { log?: (s: string) => void; only?: string[] } = {}): Promise<LibraryBuildResult> {
  const log = opts.log ?? (() => {})
  const { data: libs } = await sb.from('tc_form_libraries').select('id, code')
  const codeOf = new Map((libs ?? []).map((l) => [String(l.id), String(l.code)]))
  const versions: VersionRow[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb
      .from('tc_form_versions')
      .select('id, library_id, form_number, name, blank_pdf_storage_path, sha256, page_count, field_map, field_map_source, superseded_by, retired_at')
      .range(from, from + 499)
    if (error) throw new Error(`tc_form_versions: ${error.message}`)
    versions.push(...((data ?? []) as VersionRow[]))
    if (!data || data.length < 500) break
  }
  const skipped: LibraryBuildResult['skipped'] = []
  const live = versions.filter((v) => {
    if (!v.blank_pdf_storage_path) return skipped.push({ name: v.name, reason: 'no blank' }), false
    if (v.superseded_by) return skipped.push({ name: v.name, reason: 'superseded' }), false
    if (opts.only && !opts.only.includes(v.form_number ?? '')) return false
    return true
  })
  // A SAMPLE placeholder only stands in when the library has no licensed blank of that form.
  const licensed = new Set(live.filter((v) => !SAMPLE.test(v.name)).map((v) => `${v.library_id}:${v.form_number}`))
  const use = live.filter((v) => {
    if (SAMPLE.test(v.name) && licensed.has(`${v.library_id}:${v.form_number}`)) {
      skipped.push({ name: v.name, reason: 'sample placeholder; licensed blank present' })
      return false
    }
    return true
  })

  type Group = { key: string; identity: ReturnType<typeof identityOf>; title: string; versionId: string; builds: BuiltPage[][] }
  const groups = new Map<string, Group>()
  for (const v of use) {
    const { data: blob, error } = await sb.storage.from(TEMPLATE_BUCKET).download(v.blank_pdf_storage_path!)
    const alt = error ? await sb.storage.from('tc-documents').download(v.blank_pdf_storage_path!) : null
    const file = blob ?? alt?.data
    if (!file) {
      skipped.push({ name: v.name, reason: `blank not downloadable: ${error?.message ?? 'missing'}` })
      continue
    }
    let built: BuiltPage[]
    try {
      built = await buildPagesFromPdf(await file.arrayBuffer(), v.field_map ?? [])
    } catch (e) {
      skipped.push({ name: v.name, reason: `render failed: ${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    if (!built.length) continue
    const code = codeOf.get(v.library_id) ?? 'other'
    // A packet can open with another form's page (the Oregon REALTORS® 1.1 packet opens with the
    // Final Agency Acknowledgement): the footer that prints the blank's own number names it.
    const own = (v.form_number ?? '').replace(/^0+/, '')
    const footers = built.map((b) => b.page.footer).filter((f): f is FooterId => !!f)
    const named = footers.find((f) => own && (f.number ?? '').replace(/^0+/, '') === own) ?? footers[0] ?? null
    const identity = identityOf(code, v, named)
    const key = `${identity.family}|${identity.formNumber}|${identity.release ?? ''}|${built.length}`
    const g = groups.get(key)
    if (g) g.builds.push(built)
    else groups.set(key, { key, identity, title: v.name.replace(/\s+\d+\s+-\s+/, ' - ').replace(/\s*\(\d+\)\s*/, ' '), versionId: v.id, builds: [built] })
    log(`read ${v.name} → ${key}`)
  }

  // A blank whose text layer is unreadable has no footer, so no release. If
  // its pages are the same printing as a blank of the same form that does
  // print its release, it is that release.
  for (const g of [...groups.values()].filter((x) => x.identity.release == null)) {
    const peers = [...groups.values()].filter(
      (x) => x !== g && x.identity.release != null && x.identity.family === g.identity.family && x.identity.formNumber === g.identity.formNumber && x.builds[0].length === g.builds[0].length,
    )
    const same = peers.find((peer) => samePrinting(g.builds[0], peer.builds[0]))
    if (same) {
      same.builds.push(...g.builds)
      groups.delete(g.key)
      log(`${g.title}: no readable footer; same printing as ${same.key}`)
    }
  }

  let templates = 0
  const saved: string[] = []
  // Two blanks of one name and release with different page counts (a one-page form and a
  // packet that opens with it) are kept apart by page count.
  const sameName = new Map<string, number>()
  for (const g of groups.values()) {
    const k = `${g.identity.family}|${g.identity.formNumber}|${g.identity.release ?? ''}`
    sameName.set(k, (sameName.get(k) ?? 0) + 1)
  }
  for (const g of groups.values()) {
    // Signature lines come from a blank whose text is readable.
    g.builds.sort((a, b) => Number(b.some((p) => p.page.footer)) - Number(a.some((p) => p.page.footer)))
    const first = g.builds[0]
    const masks = first.map((b, i) => (g.builds.length > 1 ? consensus(g.builds.map((bb) => bb[i].mask), 1) : b.mask))
    const pages: TemplatePage[] = first.map((b, i) => ({ ...b.page, descriptor: descriptor(masks[i]) }))
    const id = await saveTemplate(sb, {
      family: g.identity.family,
      formNumber: g.identity.formNumber,
      release: g.identity.release,
      edition: (sameName.get(`${g.identity.family}|${g.identity.formNumber}|${g.identity.release ?? ''}`) ?? 1) > 1 ? `p${first.length}` : 'a',
      title: g.title,
      source: 'library',
      formVersionId: g.versionId,
      copies: g.builds.length,
      pages,
      masks,
    })
    saved.push(id)
    templates++
  }
  // A licensed blank now covers these releases: templates learned for them are retired.
  for (const g of groups.values()) {
    let q = sb.from('tc_form_templates').update({ status: 'retired', updated_at: new Date().toISOString() }).eq('source', 'learned').eq('status', 'active').eq('family', g.identity.family).eq('form_number', g.identity.formNumber)
    q = g.identity.release == null ? q.is('release', null) : q.eq('release', g.identity.release)
    await q
  }
  // Library templates this build no longer produces (a blank replaced, a release merged) are retired.
  let stale = sb.from('tc_form_templates').update({ status: 'retired', updated_at: new Date().toISOString() }).eq('source', 'library').eq('status', 'active')
  if (opts.only) stale = stale.in('form_number', opts.only)
  if (saved.length) stale = stale.not('id', 'in', `(${saved.join(',')})`)
  await stale
  return { templates, versions: use.length, skipped }
}

export async function saveTemplate(
  sb: SupabaseClient,
  t: {
    family: string
    formNumber: string
    release: string | null
    edition: string
    title: string
    source: 'library' | 'learned'
    formVersionId: string | null
    copies: number
    pages: TemplatePage[]
    masks: Mask[]
    status?: 'active' | 'candidate'
  },
): Promise<string> {
  let q = sb.from('tc_form_templates').select('id').eq('family', t.family).eq('form_number', t.formNumber).eq('edition', t.edition)
  q = t.release == null ? q.is('release', null) : q.eq('release', t.release)
  const { data: existing } = await q.maybeSingle()
  const id = (existing?.id as string | undefined) ?? crypto.randomUUID()
  const masksPath = `templates/${id}.bin`
  const up = await sb.storage.from(TEMPLATE_BUCKET).upload(masksPath, encodeMasks(t.masks), { contentType: 'application/octet-stream', upsert: true })
  if (up.error) throw new Error(`template masks upload: ${up.error.message}`)
  const row = {
    id,
    family: t.family,
    form_number: t.formNumber,
    release: t.release,
    edition: t.edition,
    title: t.title,
    page_count: t.pages.length,
    source: t.source,
    form_version_id: t.formVersionId,
    copies: t.copies,
    pages: t.pages.map((p) => ({ ...p, descriptor: Buffer.from(p.descriptor).toString('base64') })),
    masks_path: masksPath,
    status: t.status ?? 'active',
    builder_version: TEMPLATE_BUILDER_VERSION,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('tc_form_templates').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`tc_form_templates: ${error.message}`)
  return id
}
