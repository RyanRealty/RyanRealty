/**
 * Read the terms of one PDF twice, independently, and keep what agrees.
 *
 *  - Claude reads the PDF itself: a PDF of just the contract pages goes to the
 *    Messages API as a document, so the model sees each page's text layer AND
 *    its image (scans, handwriting, checkboxes, e-sign stamps).
 *  - Grok reads our own renders of the same pages (lib/grok, the stack the
 *    document reader runs on).
 *
 * The two are different models on different inputs, so one misreading a
 * digit does not become the file's number: ./agree.ts keeps a term only when
 * both read it the same, and lists the rest for a person.
 */
import { PDFDocument } from 'pdf-lib'
import { createAnthropic, modelCostUsd } from '@/lib/ai/anthropic'
import { GROK_MODELS } from '@/lib/grok/client'
import { readImagesStructured, type VisionPart } from '@/lib/grok/vision'
import { openPdf } from '@/lib/tc/doc-read/pdf-pages'
import { agreeReadings, type AgreedReading } from './agree'
import {
  TERMS_SCHEMA,
  TERMS_SYSTEM,
  normalizeTermsReading,
  termsInstruction,
  type InstrumentKind,
  type TermsDocumentReading,
} from './schema'

/** The forms on one PDF to read, with their pages in the file (1-based). */
export type TermsForm = { kind: InstrumentKind; title: string; pages: number[] }

/** A sale agreement runs 12 to 15 pages; a packet with several forms stays under this. */
export const MAX_TERMS_PAGES = 30

export function claudeTermsModel(): string {
  return process.env.TC_TERMS_CLAUDE_MODEL?.trim() || 'claude-opus-5-5'
}

export function grokTermsModel(): string {
  return process.env.TC_TERMS_GROK_MODEL?.trim() || GROK_MODELS.documents
}

export type ReaderRun = { model: string; costUsd: number | null; inputTokens: number | null; outputTokens: number | null; ms: number; error: string | null }

export type TermsRead = {
  forms: TermsForm[]
  pages: number[]
  claude: TermsDocumentReading | null
  grok: TermsDocumentReading | null
  agreed: AgreedReading | null
  runs: { claude: ReaderRun; grok: ReaderRun }
}

function pagesOf(forms: TermsForm[]): number[] {
  return Array.from(new Set(forms.flatMap((f) => f.pages))).sort((a, b) => a - b).slice(0, MAX_TERMS_PAGES)
}

function costOrNull(model: string, input: number, output: number): number | null {
  try {
    return modelCostUsd(model, input, output)
  } catch {
    return null // a model the pricing table does not list yet: tokens are still recorded
  }
}

/** A PDF of just these pages, so the model reads only the contract. Page k of it is pages[k-1] of the file. */
async function subPdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, pages.map((p) => p - 1).filter((i) => i >= 0 && i < src.getPageCount()))
  for (const p of copied) out.addPage(p)
  return out.save()
}

/** Page numbers in a reading made on a sub-PDF, back to the file's own numbers. */
function remapPages(r: TermsDocumentReading, pages: number[]): TermsDocumentReading {
  const back = (n: number | null) => (n != null && n >= 1 && n <= pages.length ? pages[n - 1] : null)
  return {
    unreadablePages: r.unreadablePages.map((n) => back(n)).filter((n): n is number => n != null),
    instruments: r.instruments.map((i) => {
      const out = { ...i } as Record<string, unknown>
      for (const [k, v] of Object.entries(i)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && 'page' in (v as object)) out[k] = { ...(v as object), page: back((v as { page: number | null }).page) }
      }
      return out as unknown as typeof i
    }),
  }
}

async function readWithClaude(bytes: Uint8Array, forms: TermsForm[], pages: number[]): Promise<{ reading: TermsDocumentReading | null; run: ReaderRun }> {
  const model = claudeTermsModel()
  const t0 = Date.now()
  try {
    const sub = await subPdf(bytes, pages)
    const local = (p: number) => pages.indexOf(p) + 1
    const instruction = termsInstruction({ kinds: forms.map((f) => ({ ...f, pages: f.pages.filter((p) => pages.includes(p)).map(local) })) })
    const res = await createAnthropic().messages.create({
      model,
      max_tokens: 8000,
      system: TERMS_SYSTEM,
      tools: [{ name: 'record_terms', description: 'Record the terms transcribed from the forms.', input_schema: TERMS_SCHEMA as { type: 'object' } }],
      tool_choice: { type: 'tool', name: 'record_terms' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(sub).toString('base64') } },
            { type: 'text', text: instruction },
          ],
        },
      ],
    })
    const use = res.content.find((b) => b.type === 'tool_use')
    const reading = use && use.type === 'tool_use' ? remapPages(normalizeTermsReading(use.input, new Set(pages.map(local))), pages) : null
    const inputTokens = res.usage?.input_tokens ?? null
    const outputTokens = res.usage?.output_tokens ?? null
    return {
      reading,
      run: { model, costUsd: costOrNull(model, inputTokens ?? 0, outputTokens ?? 0), inputTokens, outputTokens, ms: Date.now() - t0, error: reading ? null : 'no tool call in the reply' },
    }
  } catch (e) {
    return { reading: null, run: { model, costUsd: null, inputTokens: null, outputTokens: null, ms: Date.now() - t0, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) } }
  }
}

async function readWithGrok(bytes: Uint8Array, forms: TermsForm[], pages: number[]): Promise<{ reading: TermsDocumentReading | null; run: ReaderRun }> {
  const model = grokTermsModel()
  const t0 = Date.now()
  const pdf = await openPdf(bytes)
  try {
    const parts: VisionPart[] = []
    for (const p of pages) {
      parts.push({ type: 'text', text: `Page ${p}:` })
      parts.push({ type: 'image', jpeg: await pdf.render(p), detail: 'high' })
    }
    parts.push({ type: 'text', text: termsInstruction({ kinds: forms.map((f) => ({ ...f, pages: f.pages.filter((p) => pages.includes(p)) })) }) })
    const res = await readImagesStructured<unknown>({ system: TERMS_SYSTEM, parts, schema: TERMS_SCHEMA, schemaName: 'deal_terms', model, maxTokens: 8000 })
    return {
      reading: normalizeTermsReading(res.data, new Set(pages)),
      run: { model, costUsd: res.costUsd, inputTokens: res.inputTokens, outputTokens: res.outputTokens, ms: Date.now() - t0, error: null },
    }
  } catch (e) {
    return { reading: null, run: { model, costUsd: null, inputTokens: null, outputTokens: null, ms: Date.now() - t0, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) } }
  } finally {
    await pdf.close()
  }
}

/**
 * Both readers on the same pages, at the same time. When either reader fails
 * there is no agreed reading: nothing is written from one reader alone.
 */
export async function readTermsTwice(bytes: Uint8Array, forms: TermsForm[]): Promise<TermsRead> {
  const pages = pagesOf(forms)
  const [c, g] = await Promise.all([readWithClaude(bytes, forms, pages), readWithGrok(bytes, forms, pages)])
  return {
    forms,
    pages,
    claude: c.reading,
    grok: g.reading,
    agreed: c.reading && g.reading ? agreeReadings(c.reading, g.reading) : null,
    runs: { claude: c.run, grok: g.run },
  }
}
