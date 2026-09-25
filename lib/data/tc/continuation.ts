import 'server-only'

/**
 * A lined section's text on a draft packet, and the addendum its overflow
 * continues on (Matt 2026-09-24; lib/tc/text-areas.ts lays the lines,
 * lib/tc/continuation.ts plans the addendum). One call applies every section
 * of the envelope at once, so paragraph and addendum numbers stay consistent:
 *
 *   1. every lined section of every form in the packet gets its text laid onto
 *      its own printed lines; a section that overflows ends its last line with
 *      "(Continued: Addendum No. N, paragraph P)";
 *   2. the rest goes onto the addendum the form's own set names (OREF 002, or
 *      the OR 2.2 General Addendum), paragraph by paragraph, each opening with
 *      "P. (From: <form>, Page <n>, <section>) ..."; header filled from the
 *      file; the next addendum number on the file;
 *   3. the addendum is placed right after its form in the packet, with a
 *      signature and date line for each buyer and seller who signs the packet.
 *
 * Re-applying replaces the packet's continuation addenda; only a draft packet
 * can change.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { createHash, randomUUID } from 'node:crypto'
import { PDFArray, PDFDict, PDFDocument, PDFName, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { createServiceClient } from '@/lib/supabase/service'
import { areaReference, lineHasLabel, pageMarks, referenceLabel, type AreaReference, type PageMarks } from '@/lib/tc/area-reference'
import { readPdfTextRuns } from '@/lib/tc/pdf-page-text'
import { fieldRectToPdf } from '@/lib/tc/seal-pdf'
import { areaSpace, findTextAreas, helveticaWidth, layoutAreaText, pdfSafeText, type AreaCandidate, type TextArea } from '@/lib/tc/text-areas'
import {
  continuationFormFor,
  continuedMarker,
  layoutWithMarker,
  planContinuationPages,
  sectionName,
  type ContinuationForm,
  type ContinuationPlan,
  type SourceOverflow,
} from '@/lib/tc/continuation'
import type { SignFieldValue } from '@/lib/tc/signing'

type Obj = Record<string, unknown>
type MapEntry = { page: number; x: number; y: number; w: number; h: number; label: string | null; dataRef: string | null; type: string }

const INK = rgb(0.1, 0.1, 0.1)

// ── the two continuation forms: where each header value and signature goes ─

type Slots = {
  saleAgreement: string[]
  addendumNumber: string[]
  property: string[]
  buyers: string[]
  sellers: string[]
  buyerRows: Array<{ sign: string; date: string; print?: string }>
  sellerRows: Array<{ sign: string; date: string; print?: string }>
}

/** Field names on the live blanks (checked against a render of each, 2026-09-24). */
const SLOTS: Record<ContinuationForm['formNumber'], Slots> = {
  '002': {
    saleAgreement: ['Text1'],
    addendumNumber: ['Text2'],
    buyers: ['Text3'],
    sellers: ['Text4'],
    property: ['Text5', 'Text6', 'Text34'],
    buyerRows: [
      { sign: 'Text8', print: 'Text9', date: 'Text26' },
      { sign: 'Text10', print: 'Text11', date: 'Text27' },
      { sign: 'Text12', print: 'Text13', date: 'Text28' },
      { sign: 'Text14', print: 'Text15', date: 'Text29' },
    ],
    sellerRows: [
      { sign: 'Text16', print: 'Text17', date: 'Text30' },
      { sign: 'Text18', print: 'Text19', date: 'Text31' },
      { sign: 'Text20', print: 'Text21', date: 'Text32' },
      { sign: 'Text22', print: 'Text23', date: 'Text33' },
    ],
  },
  '2.2': {
    saleAgreement: ['Sale Agreement'],
    addendumNumber: ['This Addendum'],
    buyers: ['Buyer', 'Buyer_2', 'Buyer_3', 'Buyer_4'],
    sellers: ['Seller', 'Seller_2', 'Seller_3', 'Seller_4'],
    property: ['1 1 Property Address or Description'],
    buyerRows: [
      { sign: 'Buyer_5', date: 'Dated' },
      { sign: 'Buyer_6', date: 'Dated_3' },
      { sign: 'Buyer_7', date: 'Dated_5' },
      { sign: 'Buyer_8', date: 'Dated_7' },
    ],
    sellerRows: [
      { sign: 'Seller_5', date: 'Dated_2' },
      { sign: 'Seller_6', date: 'Dated_4' },
      { sign: 'Seller_7', date: 'Dated_6' },
      { sign: 'Seller_8', date: 'Dated_8' },
    ],
  },
}

const nameOf = (m: MapEntry) => (m.label ?? m.dataRef ?? '').trim()

function parseMap(raw: unknown): MapEntry[] {
  return (Array.isArray(raw) ? raw : []).map((m: Obj) => ({
    page: Number(m.page ?? 1),
    x: Number(m.x),
    y: Number(m.y),
    w: Number(m.w),
    h: Number(m.h),
    label: (m.label as string | null) ?? null,
    dataRef: (m.dataRef as string | null) ?? null,
    type: String(m.type ?? 'text'),
  }))
}

/** The form-map entry at the same spot as an envelope field (fields are copied from the map). */
function labelAt(f: { page: number; x: number; y: number }, map: readonly MapEntry[]): string | null {
  const hit = map.find((m) => m.page === f.page && Math.abs(m.x - f.x) < 0.004 && Math.abs(m.y - f.y) < 0.004)
  return hit ? nameOf(hit) || null : null
}

// ── drawing the continuation page ───────────────────────────────────────────

function drawFit(page: PDFPage, font: PDFFont, box: { x: number; y: number; w: number; h: number }, text: string, maxSize: number) {
  const t = pdfSafeText(text).replace(/\n/g, ' ')
  if (!t) return
  const W = page.getWidth()
  const H = page.getHeight()
  const r = fieldRectToPdf(box, W, H)
  // A box drawn as little more than the printed line (some Print lines): the
  // name sits on the line at a readable size, never through it.
  const thin = r.h < 8
  let size = thin ? Math.min(maxSize, 9) : Math.min(maxSize, Math.max(7, r.h * 0.72))
  while (size > 5 && font.widthOfTextAtSize(t, size) > r.w - 4) size -= 0.25
  const y = thin ? r.y + r.h + 1.5 : r.y + (r.h - size) / 2 + 1
  page.drawText(t, { x: r.x + 2, y, size, font, color: INK })
}

/** Fill a run of header boxes with values, one value per box, the rest joined into the last box. */
function fillBoxes(page: PDFPage, font: PDFFont, boxes: MapEntry[], values: string[], maxSize = 10) {
  if (!boxes.length) return
  const vals = values.filter(Boolean)
  if (boxes.length === 1) return drawFit(page, font, boxes[0], vals.join(', '), maxSize)
  boxes.forEach((b, i) => {
    const v = i === boxes.length - 1 ? vals.slice(i).join(', ') : vals[i]
    if (v) drawFit(page, font, b, v, maxSize)
  })
}

async function buildContinuationPdf(input: {
  blank: Uint8Array
  map: MapEntry[]
  slots: Slots
  body: TextArea<MapEntry>
  lines: string[]
  size: number
  header: { saleAgreement: string | null; addendumNumber: number; property: string; buyers: string[]; sellers: string[] }
}): Promise<Uint8Array> {
  const src = await PDFDocument.load(input.blank, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const [p] = await out.copyPages(src, [0])
  out.addPage(p)
  const page = out.getPage(0)
  // The blank's form widgets come across as bare annotations with their own
  // (white) appearance, which a viewer paints over the text drawn below: the
  // page would read blank. Only the page's links stay.
  const annots = page.node.lookup(PDFName.of('Annots'))
  if (annots instanceof PDFArray) {
    const keep = PDFArray.withContext(out.context)
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i)
      if (a instanceof PDFDict && a.lookup(PDFName.of('Subtype')) !== PDFName.of('Widget')) keep.push(annots.get(i))
    }
    if (keep.size()) page.node.set(PDFName.of('Annots'), keep)
    else page.node.delete(PDFName.of('Annots'))
  }
  const font = await out.embedFont(StandardFonts.Helvetica)
  const by = (names: string[]) => names.map((n) => input.map.find((m) => m.page === 1 && nameOf(m) === n)).filter((m): m is MapEntry => !!m)
  const h = input.header
  fillBoxes(page, font, by(input.slots.saleAgreement), [h.saleAgreement ?? ''])
  fillBoxes(page, font, by(input.slots.addendumNumber), [String(h.addendumNumber)])
  fillBoxes(page, font, by(input.slots.buyers), h.buyers)
  fillBoxes(page, font, by(input.slots.sellers), h.sellers)
  // An address too long for its line carries onto the next line of the block.
  const propBoxes = by(input.slots.property)
  if (propBoxes.length > 1 && font.widthOfTextAtSize(pdfSafeText(h.property), 10) > fieldRectToPdf(propBoxes[0], page.getWidth(), page.getHeight()).w - 4) {
    const cut = h.property.lastIndexOf(',')
    fillBoxes(page, font, propBoxes.slice(0, 2), cut > 0 ? [h.property.slice(0, cut), h.property.slice(cut + 1).trim()] : [h.property])
  } else fillBoxes(page, font, propBoxes.slice(0, 1), [h.property])
  // Printed names under each signature line, for the parties who sign.
  input.slots.buyerRows.forEach((r, i) => r.print && h.buyers[i] && fillBoxes(page, font, by([r.print]), [h.buyers[i]]))
  input.slots.sellerRows.forEach((r, i) => r.print && h.sellers[i] && fillBoxes(page, font, by([r.print]), [h.sellers[i]]))
  // The body: every line exactly as laid out.
  input.body.lines.forEach((l, i) => {
    const text = input.lines[i]
    if (!text) return
    const r = fieldRectToPdf(l, page.getWidth(), page.getHeight())
    page.drawText(pdfSafeText(text), { x: r.x + 2, y: r.y + (r.h - input.size) / 2 + 1, size: input.size, font, color: INK })
  })
  return out.save()
}

// ── numbering ───────────────────────────────────────────────────────────────

const GENERAL_ADDENDUM = /general addendum|addendum to (sale|real estate)/i

/**
 * The next addendum number on the file (Matt 2026-09-24: "Next number on the
 * file"): one past the highest general addendum on the cycle, counting the
 * continuations of other packets and leaving out this packet's own.
 */
export async function nextAddendumNumber(sb: SupabaseClient, cycleId: string, envelopeId: string): Promise<number> {
  const { data } = await sb.from('tc_documents').select('id, sha256, classification').eq('cycle_id', cycleId).eq('archived', false)
  let highest = 0
  const unnumbered = new Set<string>()
  for (const d of (data ?? []) as Array<{ id: string; sha256: string | null; classification: Obj | null }>) {
    const c = d.classification ?? {}
    const cont = c.continuation as { envelope_id?: string; addendum_number?: number } | undefined
    if (cont) {
      if (cont.envelope_id !== envelopeId && Number(cont.addendum_number) > highest) highest = Number(cont.addendum_number)
      continue
    }
    const forms = ((c.reader as Obj | undefined)?.forms ?? []) as Array<{ form?: string; instance?: string | number | null }>
    for (const f of forms) {
      if (!GENERAL_ADDENDUM.test(String(f.form ?? ''))) continue
      const n = Number(f.instance)
      if (Number.isFinite(n) && n > 0) highest = Math.max(highest, n)
      else unnumbered.add(d.sha256 ?? d.id)
    }
  }
  return Math.max(highest, unnumbered.size) + 1
}

// ── applying a packet's section text ────────────────────────────────────────

export type SectionTextInput = { documentId: string; areaKey: string; text: string }

export type ApplySectionResult = {
  ok: boolean
  error?: string
  continuations?: Array<{ sourceDocumentId: string; addendumNumbers: number[] }>
}

type FieldRow = { id: string; document_id: string; recipient_id: string | null; type: string; page: number; x: number; y: number; w: number; h: number; value: SignFieldValue | null }

/** The lined sections of one packet document, with the form's own field names. */
export function sectionsOf(fields: readonly FieldRow[], map: readonly MapEntry[], marks: ReadonlyArray<PageMarks | null> = []): Array<TextArea<FieldRow & AreaCandidate>> {
  // A line already holding a deal fact (a name, the address) is not part of a
  // paragraph; a section's own lines carry their type size.
  const factFilled = (v: SignFieldValue | null) => !!v && v.kind === 'text' && !!v.text && !v.size && !v.area
  const cands = fields.filter((f) => !factFilled(f.value)).map((f) => ({ ...f, recipientId: f.recipient_id, label: labelAt(f, map) }))
  return findTextAreas(cands, (line) => lineHasLabel(marks[line.page - 1], line))
}

/** Where a section sits on the printed form, and what to call it (lib/tc/area-reference.ts). */
function sectionPlace(s: TextArea<FieldRow & AreaCandidate>, marks: ReadonlyArray<PageMarks | null>): { ref: AreaReference; title: string | null; cite: string | null } {
  const ref = areaReference(marks, s)
  // The form's field names only when the page prints no heading.
  const title = ref.heading ?? s.lines.map((l) => sectionName(l.label)).find(Boolean) ?? null
  return { ref, title, cite: referenceLabel(ref, title) }
}

// ── the printed page: sizes, headings, line numbers ─────────────────────────

type DocumentFacts = { sizes: Array<{ w: number; h: number }>; marks: PageMarks[] }
const NO_FACTS: DocumentFacts = { sizes: [], marks: [] }

async function readDocumentFacts(sb: SupabaseClient, path: string): Promise<DocumentFacts | null> {
  const { data: blob } = await sb.storage.from('tc-documents').download(path)
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true }).catch(() => null)
  if (!pdf) return null
  const sizes = pdf.getPages().map((p) => ({ w: p.getWidth(), h: p.getHeight() }))
  // A scan has no text layer: the sizes still stand, the page just names nothing.
  const runs = await readPdfTextRuns(bytes).catch(() => [])
  return { sizes, marks: runs.map(pageMarks) }
}

/**
 * A packet document's page sizes and printed marks. A stored file never
 * changes under its id and path, so the read is cached for good; an unreadable
 * file is not cached.
 */
async function documentFacts(sb: SupabaseClient, doc: { id: string; storage_path: string | null } | undefined): Promise<DocumentFacts> {
  const path = doc?.storage_path
  if (!doc || !path) return NO_FACTS
  const load = async () => {
    const facts = await readDocumentFacts(sb, path)
    if (!facts) throw new Error('unreadable document')
    return facts
  }
  try {
    return await unstable_cache(load, ['tc-document-facts-v1', doc.id, path], { revalidate: false, tags: ['tc-document-facts'] })()
  } catch (e) {
    // Outside a Next request (a script, a test) there is no data cache.
    if (/incrementalCache/i.test(String(e))) return (await readDocumentFacts(sb, path)) ?? NO_FACTS
    return NO_FACTS
  }
}

export async function applyEnvelopeSectionText(envelopeId: string, texts: readonly SectionTextInput[], actor: string, sb: SupabaseClient = createServiceClient()): Promise<ApplySectionResult> {
  const { data: env } = await sb.from('tc_envelopes').select('id, cycle_id, status').eq('id', envelopeId).maybeSingle()
  if (!env) return { ok: false, error: 'Envelope not found' }
  if (env.status !== 'draft') return { ok: false, error: 'Only a draft packet can change.' }
  const cycleId = String(env.cycle_id)

  const [{ data: envDocs }, { data: fieldRows }, { data: recips }, { data: cycle }] = await Promise.all([
    sb.from('tc_envelope_documents').select('id, document_id, form_version_id, sort_order').eq('envelope_id', envelopeId).order('sort_order'),
    sb.from('tc_envelope_fields').select('id, document_id, recipient_id, type, page, x, y, w, h, value').eq('envelope_id', envelopeId),
    sb.from('tc_envelope_recipients').select('id, role, action_required, signing_order, name').eq('envelope_id', envelopeId).order('signing_order'),
    sb.from('tc_cycles').select('id, buyers, sellers, tc_deals(address, city, state, zip)').eq('id', cycleId).maybeSingle(),
  ])
  const docIds = (envDocs ?? []).map((d) => String(d.document_id))
  const { data: docRows } = await sb.from('tc_documents').select('id, name, storage_path, classification').in('id', docIds.length ? docIds : ['00000000-0000-0000-0000-000000000000'])
  const docById = new Map((docRows ?? []).map((d) => [String(d.id), d as { id: string; name: string; storage_path: string | null; classification: Obj | null }]))
  const isContinuation = (id: string) => !!(docById.get(id)?.classification as Obj | null)?.continuation
  const sources = (envDocs ?? []).filter((d) => !isContinuation(String(d.document_id)))

  const versionIds = sources.map((d) => d.form_version_id).filter(Boolean) as string[]
  const { data: versions } = await sb.from('tc_form_versions').select('id, name, field_map, tc_form_libraries(code)').in('id', versionIds.length ? versionIds : ['00000000-0000-0000-0000-000000000000'])
  const versionById = new Map((versions ?? []).map((v) => [String(v.id), v as { id: string; name: string; field_map: unknown; tc_form_libraries: { code?: string } | Array<{ code?: string }> | null }]))

  const fields = (fieldRows ?? []).map((f) => ({ ...f, x: Number(f.x), y: Number(f.y), w: Number(f.w), h: Number(f.h) })) as FieldRow[]
  const wanted = new Map(texts.map((t) => [`${t.documentId}|${t.areaKey}`, t.text]))
  const deal = (Array.isArray(cycle?.tc_deals) ? cycle?.tc_deals[0] : cycle?.tc_deals) as { address?: string; city?: string; state?: string; zip?: string } | undefined
  // The address as the form's own address line carries it (lib/tc/oref-fill.ts),
  // with the city added only when the address does not already name it.
  const street = (deal?.address ?? '').trim()
  const place = [deal?.city, [deal?.state, deal?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const property = street && deal?.city && street.toLowerCase().includes(deal.city.toLowerCase()) ? street : [street, place].filter(Boolean).join(', ')
  const names = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
  const buyers = names(cycle?.buyers)
  const sellers = names(cycle?.sellers)
  const signers = (role: string) => (recips ?? []).filter((r) => String(r.role) === role && String(r.action_required ?? 'NeedsToSign') === 'NeedsToSign')

  let nextNumber = await nextAddendumNumber(sb, cycleId, envelopeId)
  const valueUpdates: Array<{ id: string; value: SignFieldValue | null }> = []
  const toCreate: Array<{ sourceDocumentId: string; form: ContinuationForm; plan: ContinuationPlan }> = []

  for (const src of sources) {
    const documentId = String(src.document_id)
    const version = src.form_version_id ? versionById.get(String(src.form_version_id)) : undefined
    const map = parseMap(version?.field_map)
    const docFields = fields.filter((f) => f.document_id === documentId)
    // The printed page only ever splits a run of lines, so a form with no run needs no read.
    if (!sectionsOf(docFields, map).length) continue
    // Page sizes for the exact line widths; the printed rows, headings and line numbers.
    const { sizes, marks } = await documentFacts(sb, docById.get(documentId))
    const sections = sectionsOf(docFields, map, marks)
    if (!sections.length) continue
    const lib = Array.isArray(version?.tc_form_libraries) ? version?.tc_form_libraries[0]?.code : version?.tc_form_libraries?.code
    const form = continuationFormFor(lib ?? null)
    const formName = version?.name?.replace(/\s*\(\d+\)\s*-\s*/, ' - ') ?? docById.get(documentId)?.name ?? 'the form'

    // Each section's text: what the broker just typed, else what it held.
    const withText = sections
      .map((s) => {
        const key = `${documentId}|${s.key}`
        const held = (s.lines[0].value as { area?: { text?: string } } | null)?.area?.text ?? s.lines.map((l) => (l.value as { text?: string } | null)?.text ?? '').filter(Boolean).join(' ')
        return { s, text: wanted.has(key) ? wanted.get(key)! : held }
      })
      .filter((x) => x.text.trim() || wanted.has(`${documentId}|${x.s.key}`))

    // Lay out, plan, and settle the markers: a section's marker names the
    // addendum and paragraph its text lands on, which the plan decides.
    const firstNumber = nextNumber
    let starts: Record<string, { addendumNumber: number; paragraph: string }> = {}
    let layouts: Array<{ s: (typeof withText)[number]['s']; lines: string[]; size: number; overflow: string }> = []
    let plan: ContinuationPlan = { pages: [], starts: {} }
    for (let round = 0; round < 4; round++) {
      layouts = []
      const overflows: SourceOverflow[] = []
      let paragraph = 0
      for (const { s, text } of withText) {
        const size = sizes[s.page - 1] ?? { w: 612, h: 792 }
        const { space, size: typeSize } = areaSpace(s.lines, size.w, size.h)
        const probe = layoutAreaText(text, space, typeSize)
        if (!probe.overflow) {
          layouts.push({ s, lines: probe.lines, size: typeSize, overflow: '' })
          continue
        }
        paragraph++
        const at = starts[s.key] ?? { addendumNumber: firstNumber, paragraph: String(paragraph) }
        const r = layoutWithMarker(text, space, typeSize, continuedMarker(form, at.addendumNumber, at.paragraph))
        layouts.push({ s, lines: r.lines, size: typeSize, overflow: r.overflow })
        overflows.push({ key: s.key, formName, page: s.page, section: sectionPlace(s, marks).cite, text: r.overflow })
      }
      if (!overflows.length) {
        plan = { pages: [], starts: {} }
        break
      }
      const addendum = await loadContinuationForm(sb, form)
      if (!addendum) return { ok: false, error: `The ${form.title} (${form.library} ${form.formNumber}) is not in the form library.` }
      const bodySize = { w: 612, h: 792 }
      const { space: body, size: bodyType } = areaSpace(addendum.body.lines, bodySize.w, bodySize.h)
      plan = planContinuationPages(overflows, { form, firstNumber, body, size: bodyType })
      const settled = overflows.every((o) => starts[o.key] && starts[o.key].addendumNumber === plan.starts[o.key].addendumNumber && starts[o.key].paragraph === plan.starts[o.key].paragraph)
      starts = plan.starts
      if (settled) break
    }

    for (const l of layouts) {
      l.s.lines.forEach((line, i) => {
        const text = l.lines[i] ?? ''
        const typed = withText.find((w) => w.s.key === l.s.key)?.text ?? ''
        valueUpdates.push({
          id: line.id,
          value: text || i === 0 ? { kind: 'text', text, size: l.size, ...(i === 0 ? { area: { key: l.s.key, text: typed } } : {}) } : null,
        })
      })
    }
    if (plan.pages.length) {
      toCreate.push({ sourceDocumentId: documentId, form, plan })
      nextNumber += plan.pages.length
    }
  }

  // Replace this packet's earlier continuations: out of the packet, archived
  // on the file (kept, like every document, for the record).
  const oldIds = (docRows ?? []).filter((d) => (d.classification as Obj | null)?.continuation).map((d) => String(d.id))
  if (oldIds.length) {
    await sb.from('tc_envelope_fields').delete().eq('envelope_id', envelopeId).in('document_id', oldIds)
    await sb.from('tc_envelope_documents').delete().eq('envelope_id', envelopeId).in('document_id', oldIds)
    await sb
      .from('tc_documents')
      .update({ archived: true, archived_reason: 'Continuation addendum replaced when the section text changed', archived_at: new Date().toISOString() })
      .in('id', oldIds)
  }

  for (const u of valueUpdates) {
    const { error } = await sb.from('tc_envelope_fields').update({ value: u.value }).eq('id', u.id)
    if (error) return { ok: false, error: `saving the section text: ${error.message}` }
  }

  // Build each continuation addendum and place it right after its form.
  const created: Array<{ sourceDocumentId: string; documentId: string; addendumNumber: number }> = []
  for (const c of toCreate) {
    const addendum = await loadContinuationForm(sb, c.form)
    if (!addendum) return { ok: false, error: `The ${c.form.title} is not in the form library.` }
    const saleAgreement = saleAgreementNumberOf(fields.filter((f) => f.document_id === c.sourceDocumentId), parseMap(versionById.get(String(sources.find((s) => String(s.document_id) === c.sourceDocumentId)?.form_version_id))?.field_map))
    for (const pg of c.plan.pages) {
      const { size: bodyType } = areaSpace(addendum.body.lines, 612, 792)
      const bytes = await buildContinuationPdf({
        blank: addendum.blank,
        map: addendum.map,
        slots: SLOTS[c.form.formNumber],
        body: addendum.body,
        lines: pg.lines,
        size: bodyType,
        header: { saleAgreement, addendumNumber: pg.addendumNumber, property, buyers, sellers },
      })
      const sha = createHash('sha256').update(bytes).digest('hex')
      const path = `forms/${cycleId}/continuation/${envelopeId}/${randomUUID()}.pdf`
      const up = await sb.storage.from('tc-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
      if (up.error) return { ok: false, error: `storing the addendum: ${up.error.message}` }
      const sourceName = docById.get(c.sourceDocumentId)?.name ?? 'the form'
      const { data: doc, error } = await sb
        .from('tc_documents')
        .insert({
          cycle_id: cycleId,
          name: `${c.form.title} No. ${pg.addendumNumber} (continued from ${sourceName.replace(/\.pdf$/i, '')}).pdf`,
          storage_path: path,
          sha256: sha,
          bytes: bytes.byteLength,
          content_type: 'application/pdf',
          page_count: 1,
          classification: {
            source: 'continuation',
            continuation: { envelope_id: envelopeId, source_document_id: c.sourceDocumentId, addendum_number: pg.addendumNumber, form: `${c.form.library} ${c.form.formNumber}`, form_version_id: addendum.id, created_by: actor },
          },
        })
        .select('id')
        .single()
      if (error || !doc) return { ok: false, error: `recording the addendum: ${error?.message ?? 'no row'}` }
      created.push({ sourceDocumentId: c.sourceDocumentId, documentId: String(doc.id), addendumNumber: pg.addendumNumber })

      // A signature and date line for each buyer and seller who signs the packet.
      const byName = (n: string) => addendum.map.find((m) => m.page === 1 && nameOf(m) === n)
      const rows: Obj[] = []
      const place = (row: { sign: string; date: string }, recipientId: string) => {
        const s = byName(row.sign)
        const d = byName(row.date)
        if (s) rows.push({ envelope_id: envelopeId, document_id: doc.id, recipient_id: recipientId, type: 'signature', page: 1, x: s.x, y: s.y, w: s.w, h: Math.max(s.h, 0.02), required: true })
        if (d) rows.push({ envelope_id: envelopeId, document_id: doc.id, recipient_id: recipientId, type: 'date_signed', page: 1, x: d.x, y: d.y, w: d.w, h: d.h, required: true })
      }
      signers('Buyer').slice(0, 4).forEach((r, i) => place(SLOTS[c.form.formNumber].buyerRows[i], String(r.id)))
      signers('Seller').slice(0, 4).forEach((r, i) => place(SLOTS[c.form.formNumber].sellerRows[i], String(r.id)))
      if (rows.length) {
        const { error: fErr } = await sb.from('tc_envelope_fields').insert(rows)
        if (fErr) return { ok: false, error: `placing signature lines: ${fErr.message}` }
      }
    }
  }

  // Packet order: each form, then its continuation addenda.
  const order: string[] = []
  for (const s of sources) {
    order.push(String(s.document_id))
    for (const c of created.filter((x) => x.sourceDocumentId === String(s.document_id))) order.push(c.documentId)
  }
  const existing = new Map((envDocs ?? []).filter((d) => !isContinuation(String(d.document_id))).map((d) => [String(d.document_id), String(d.id)]))
  for (let i = 0; i < order.length; i++) {
    const docId = order[i]
    if (existing.has(docId)) await sb.from('tc_envelope_documents').update({ sort_order: i }).eq('id', existing.get(docId)!)
    else {
      const { error } = await sb.from('tc_envelope_documents').insert({ envelope_id: envelopeId, document_id: docId, sort_order: i })
      if (error) return { ok: false, error: `adding the addendum to the packet: ${error.message}` }
    }
  }

  await sb.from('tc_events').insert({
    cycle_id: cycleId,
    actor,
    action: 'envelope_section_text_applied',
    detail: { envelope_id: envelopeId, sections: valueUpdates.filter((u) => (u.value as { area?: unknown } | null)?.area).length, continuations: created.map((c) => ({ source: c.sourceDocumentId, addendum: c.addendumNumber, document: c.documentId })) },
  })

  const grouped = new Map<string, number[]>()
  for (const c of created) grouped.set(c.sourceDocumentId, [...(grouped.get(c.sourceDocumentId) ?? []), c.addendumNumber])
  return { ok: true, continuations: [...grouped.entries()].map(([sourceDocumentId, addendumNumbers]) => ({ sourceDocumentId, addendumNumbers })) }
}

/** The sale agreement number the source form carries, if it has a field for it and it is filled. */
function saleAgreementNumberOf(fields: readonly FieldRow[], map: readonly MapEntry[]): string | null {
  for (const f of fields) {
    const label = labelAt(f, map) ?? ''
    if (/^sale\s*agreement\s*(#|no\.?|number)?$/i.test(label.trim())) {
      const t = (f.value as { text?: string } | null)?.text?.trim()
      if (t) return t
    }
  }
  return null
}

type LoadedForm = { id: string; blank: Uint8Array; map: MapEntry[]; body: TextArea<MapEntry> }
const formCache = new Map<string, LoadedForm | null>()

/** The live blank and field map of the continuation form, and its body section. */
async function loadContinuationForm(sb: SupabaseClient, form: ContinuationForm): Promise<LoadedForm | null> {
  const key = `${form.library}|${form.formNumber}`
  if (formCache.has(key)) return formCache.get(key)!
  // The current release: the version the printed-form checker's library
  // template is bound to (OREF 002 "Released 01/2026", OR 2.2 "Version
  // 2026-2"); the library keeps older copies of the blank under the same number.
  const { data: tmpl } = await sb
    .from('tc_form_templates')
    .select('form_version_id, updated_at')
    .eq('form_number', form.formNumber)
    .eq('source', 'library')
    .eq('status', 'active')
    .not('form_version_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
  const bound = tmpl?.[0]?.form_version_id as string | undefined
  let q = sb
    .from('tc_form_versions')
    .select('id, name, blank_pdf_storage_path, field_map, tc_form_libraries!inner(code)')
    .eq('form_number', form.formNumber)
    .eq('tc_form_libraries.code', form.library)
    .is('retired_at', null)
    .not('blank_pdf_storage_path', 'is', null)
  if (bound) q = q.eq('id', bound)
  const { data } = await q.order('name').limit(1)
  const row = data?.[0] as { id: string; blank_pdf_storage_path: string; field_map: unknown } | undefined
  if (!row) {
    formCache.set(key, null)
    return null
  }
  const { data: blob } = await sb.storage.from('tc-forms').download(row.blank_pdf_storage_path)
  const map = parseMap(row.field_map)
  const body = findTextAreas(map.map((m) => ({ ...m, label: nameOf(m) }))).sort((a, b) => b.lines.length - a.lines.length)[0]
  if (!blob || !body) {
    formCache.set(key, null)
    return null
  }
  const loaded = { id: row.id, blank: new Uint8Array(await blob.arrayBuffer()), map, body }
  formCache.set(key, loaded)
  return loaded
}

/** For tests: the width the body's first line gives the lead. */
export const _internal = { SLOTS, labelAt, helveticaWidth }

/**
 * Render continuation addendum pages without touching any packet: the plan's
 * pages drawn on the live blank. For previews and checks.
 */
export async function renderContinuationPreview(
  library: string,
  overflows: SourceOverflow[],
  header: { saleAgreement: string | null; property: string; buyers: string[]; sellers: string[] },
  firstNumber = 1,
  sb: SupabaseClient = createServiceClient(),
): Promise<{ pages: Uint8Array[]; plan: ContinuationPlan } | null> {
  const form = continuationFormFor(library)
  const addendum = await loadContinuationForm(sb, form)
  if (!addendum) return null
  const { space, size } = areaSpace(addendum.body.lines, 612, 792)
  const plan = planContinuationPages(overflows, { form, firstNumber, body: space, size })
  const pages: Uint8Array[] = []
  for (const pg of plan.pages) {
    pages.push(await buildContinuationPdf({ blank: addendum.blank, map: addendum.map, slots: SLOTS[form.formNumber], body: addendum.body, lines: pg.lines, size, header: { ...header, addendumNumber: pg.addendumNumber } }))
  }
  return { pages, plan }
}

// ── the composer's view of a packet ─────────────────────────────────────────

export type PacketSection = {
  documentId: string
  /** Stable for the form: page and first line (lib/tc/text-areas.ts). */
  key: string
  page: number
  fieldIds: string[]
  lines: Array<{ x: number; y: number; w: number; h: number }>
  /** The heading the section is printed under ("Additional Provisions"), else the form's field name for it. */
  title: string | null
  /** The heading's number ("29"). */
  number: string | null
  /** The form's printed line numbers the section covers ("349-352"). */
  printedLines: string | null
  /** The whole text the broker typed (the lines hold it laid out). */
  text: string
  /** The form set: which addendum the section continues on. */
  library: string | null
}

export type PacketContinuation = { documentId: string; sourceDocumentId: string; addendumNumber: number }

/** Every lined section on a packet's forms, and the continuation addenda already in it. */
export async function getPacketSections(envelopeId: string, sb: SupabaseClient = createServiceClient()): Promise<{ sections: PacketSection[]; continuations: PacketContinuation[] }> {
  const [{ data: envDocs }, { data: fieldRows }] = await Promise.all([
    sb.from('tc_envelope_documents').select('document_id, form_version_id, sort_order').eq('envelope_id', envelopeId).order('sort_order'),
    sb.from('tc_envelope_fields').select('id, document_id, recipient_id, type, page, x, y, w, h, value').eq('envelope_id', envelopeId),
  ])
  const docIds = (envDocs ?? []).map((d) => String(d.document_id))
  if (!docIds.length) return { sections: [], continuations: [] }
  const { data: docRows } = await sb.from('tc_documents').select('id, storage_path, classification').in('id', docIds)
  const continuations: PacketContinuation[] = []
  const contIds = new Set<string>()
  for (const d of docRows ?? []) {
    const c = (d.classification as Obj | null)?.continuation as { source_document_id?: string; addendum_number?: number } | undefined
    if (c) {
      contIds.add(String(d.id))
      continuations.push({ documentId: String(d.id), sourceDocumentId: String(c.source_document_id ?? ''), addendumNumber: Number(c.addendum_number ?? 0) })
    }
  }
  const versionIds = (envDocs ?? []).map((d) => d.form_version_id).filter(Boolean) as string[]
  const { data: versions } = versionIds.length ? await sb.from('tc_form_versions').select('id, field_map, tc_form_libraries(code)').in('id', versionIds) : { data: [] }
  const versionById = new Map((versions ?? []).map((v) => [String(v.id), v as { field_map: unknown; tc_form_libraries: { code?: string } | Array<{ code?: string }> | null }]))
  const fields = (fieldRows ?? []).map((f) => ({ ...f, x: Number(f.x), y: Number(f.y), w: Number(f.w), h: Number(f.h) })) as FieldRow[]

  const docById = new Map((docRows ?? []).map((d) => [String(d.id), { id: String(d.id), storage_path: (d.storage_path as string | null) ?? null }]))
  const perDoc = await Promise.all(
    (envDocs ?? [])
      .filter((d) => !contIds.has(String(d.document_id)))
      .map(async (d) => {
        const documentId = String(d.document_id)
        const docFields = fields.filter((f) => f.document_id === documentId)
        const version = d.form_version_id ? versionById.get(String(d.form_version_id)) : undefined
        const lib = Array.isArray(version?.tc_form_libraries) ? version?.tc_form_libraries[0]?.code : version?.tc_form_libraries?.code
        const map = parseMap(version?.field_map)
        // The printed page only ever splits a run of lines, so a form with no run needs no read.
        if (!sectionsOf(docFields, map).length) return []
        const { marks } = await documentFacts(sb, docById.get(documentId))
        return sectionsOf(docFields, map, marks).map((s): PacketSection => {
          const held = (s.lines[0].value as { area?: { text?: string } } | null)?.area?.text
          const place = sectionPlace(s, marks)
          return {
            documentId,
            key: s.key,
            page: s.page,
            fieldIds: s.lines.map((l) => l.id),
            lines: s.lines.map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h })),
            title: place.title,
            number: place.ref.heading ? place.ref.number : null,
            printedLines: place.ref.lines,
            text: held ?? s.lines.map((l) => (l.value as { text?: string } | null)?.text ?? '').filter(Boolean).join(' '),
            library: lib ?? null,
          }
        })
      }),
  )
  return { sections: perDoc.flat(), continuations }
}

/** The file broker of a packet, for the caller's file-scope check. */
export async function getPacketDealBroker(envelopeId: string, sb: SupabaseClient = createServiceClient()): Promise<{ brokerName: string | null } | null> {
  const { data } = await sb.from('tc_envelopes').select('cycle_id, tc_cycles(tc_deals(broker_name))').eq('id', envelopeId).maybeSingle()
  if (!data) return null
  const cyc = (Array.isArray(data.tc_cycles) ? data.tc_cycles[0] : data.tc_cycles) as { tc_deals?: { broker_name?: string | null } | Array<{ broker_name?: string | null }> } | null
  const deal = Array.isArray(cyc?.tc_deals) ? cyc?.tc_deals[0] : cyc?.tc_deals
  return { brokerName: deal?.broker_name ?? null }
}
