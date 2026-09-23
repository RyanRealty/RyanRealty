/**
 * Read one PDF: text-layer anatomy, pick the pages that matter, render them,
 * and have the vision model transcribe forms and signature lines.
 *
 * Cost discipline: the reader sees the first page of each form and the pages
 * with signature lines, never the contract terms in between (a 15-page OREF
 * 001 is read from 3 pages). A scan with no text layer gets a cheap low-detail
 * page map first so the full-detail pass still lands on the right pages.
 */
import { readImagesStructured, type VisionPart } from '@/lib/grok/vision'
import { GROK_MODELS } from '@/lib/grok/client'
import { openPdf } from './pdf-pages'
import {
  MAX_PAGES_PER_DOCUMENT,
  passesFor,
  pickPages,
  readAnatomy,
  type Anatomy,
  type PagePick,
  type Segment,
} from './anatomy'
import {
  READER_SYSTEM,
  READING_SCHEMA,
  normalizeReading,
  readerInstruction,
  type DocumentReading,
} from './vision-reading'

/**
 * The reader model. Chosen on the labelled set in
 * scripts/tc-doc-read-eval.ts; override with TC_DOC_READER_MODEL to re-run the
 * comparison without a code change.
 */
export function readerModel(): string {
  return process.env.TC_DOC_READER_MODEL?.trim() || GROK_MODELS.documents
}

export type ReaderPass = {
  pages: number[]
  model: string
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
  ms: number
  kind: 'page_map' | 'read'
}

export type DocumentRead = {
  anatomy: Anatomy
  picks: PagePick[]
  reading: DocumentReading
  passes: ReaderPass[]
  costUsd: number
}

const PAGE_MAP_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['page', 'title', 'pageIndex', 'pageTotal', 'hasSignatureLines'],
        properties: {
          page: { type: 'integer' },
          title: { type: ['string', 'null'] },
          pageIndex: { type: ['integer', 'null'] },
          pageTotal: { type: ['integer', 'null'] },
          hasSignatureLines: { type: 'boolean' },
        },
      },
    },
  },
}

type PageMap = {
  pages: Array<{ page: number; title: string | null; pageIndex: number | null; pageTotal: number | null; hasSignatureLines: boolean }>
}

function sameTitle(a: string | null, b: string | null): boolean {
  const n = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return !!n(a) && n(a) === n(b)
}

/** Low-detail render scale for the scan page map: enough to see a title and a signature block. */
const MAP_SCALE_NOTE = 'low'

/**
 * A scan has no text to split it into forms. One low-detail look at every
 * page tells which pages start a form and which carry signature lines.
 */
async function mapScannedPages(
  render: (n: number) => Promise<Buffer>,
  pageCount: number,
  model: string,
): Promise<{ anatomy: Pick<Anatomy, 'segments'>; flags: Map<number, boolean>; pass: ReaderPass }> {
  const pages = Array.from({ length: Math.min(pageCount, MAX_PAGES_PER_DOCUMENT) }, (_, i) => i + 1)
  const parts: VisionPart[] = []
  for (const n of pages) {
    parts.push({ type: 'text', text: `Page ${n}:` })
    parts.push({ type: 'image', jpeg: await render(n), detail: MAP_SCALE_NOTE })
  }
  parts.push({
    type: 'text',
    text: 'These are the pages of one scanned PDF. For each page: title = the form or document title printed at the top of the page, else null; pageIndex / pageTotal = the "Page X of Y" in the footer, else null; hasSignatureLines = true when the page has lines meant for full signatures (signed or not), not counting footer initials boxes.',
  })
  const res = await readImagesStructured<PageMap>({
    system: 'You map the pages of a scanned real estate document. Report only what is visible.',
    parts,
    schema: PAGE_MAP_SCHEMA,
    schemaName: 'page_map',
    model,
    maxTokens: 3000,
  })
  const segments: Segment[] = []
  const flags = new Map<number, boolean>()
  const byPage = new Map(res.data.pages.map((p) => [p.page, p]))
  let prev: PageMap['pages'][number] | undefined
  for (const n of pages) {
    const p = byPage.get(n)
    flags.set(n, !!p?.hasSignatureLines)
    // OREF prints the form title on every page, so a title alone does not
    // start a form: a different title does, and so does "Page 1 of N".
    const starts =
      !segments.length ||
      p?.pageIndex === 1 ||
      (!!p?.title && !!prev?.title && !sameTitle(p.title, prev.title))
    if (starts) {
      segments.push({ id: segments.length + 1, pages: [], oref: null, released: null, declaredPages: p?.pageTotal ?? null })
    }
    segments[segments.length - 1].pages.push(n)
    if (p) prev = p
  }
  return {
    anatomy: { segments },
    flags,
    pass: { pages, model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, costUsd: res.costUsd, ms: res.ms, kind: 'page_map' },
  }
}

export async function readDocumentBytes(bytes: Uint8Array, opts?: { model?: string }): Promise<DocumentRead> {
  const model = opts?.model ?? readerModel()
  const pdf = await openPdf(bytes)
  const passes: ReaderPass[] = []
  try {
    let anatomy = readAnatomy(await pdf.texts())
    if (anatomy.scanned && anatomy.pageCount > 3) {
      const map = await mapScannedPages(pdf.render, anatomy.pageCount, model)
      passes.push(map.pass)
      // The text layer had nothing to say; the page map supplies the structure
      // and marks the signature pages so pickPages treats them as such.
      anatomy = {
        ...anatomy,
        scanned: false,
        segments: map.anatomy.segments,
        pages: anatomy.pages.map((p) => ({
          ...p,
          textChars: Math.max(p.textChars, 200),
          signatureLabels: map.flags.get(p.page) ? ['(page map)'] : [],
        })),
      }
    }
    const picks = pickPages(anatomy)
    const merged: DocumentReading = { forms: [], unreadablePages: [], notes: '' }
    for (const pass of passesFor(picks)) {
      const parts: VisionPart[] = []
      for (const p of pass) {
        parts.push({ type: 'text', text: `Page ${p.page} (segment ${p.segment}):` })
        parts.push({ type: 'image', jpeg: await pdf.render(p.page), detail: 'high' })
      }
      parts.push({ type: 'text', text: readerInstruction({ segments: anatomy.segments, pages: pass, pageCount: anatomy.pageCount }) })
      const res = await readImagesStructured<unknown>({
        system: READER_SYSTEM,
        parts,
        schema: READING_SCHEMA,
        schemaName: 'document_reading',
        model,
        maxTokens: 6000,
      })
      const reading = normalizeReading(res.data, new Set(pass.map((p) => p.page)))
      merged.forms.push(...reading.forms)
      merged.unreadablePages.push(...reading.unreadablePages)
      if (reading.notes) merged.notes = merged.notes ? `${merged.notes} ${reading.notes}` : reading.notes
      passes.push({
        pages: pass.map((p) => p.page),
        model,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costUsd: res.costUsd,
        ms: res.ms,
        kind: 'read',
      })
    }
    const costUsd = passes.reduce((s, p) => s + (p.costUsd ?? 0), 0)
    return { anatomy, picks, reading: merged, passes, costUsd }
  } finally {
    await pdf.close()
  }
}
