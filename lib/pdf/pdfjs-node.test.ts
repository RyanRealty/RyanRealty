import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { inspectPdfPageSafety } from './assert-page-safety'
import { configurePdfjsWorker, resolvePdfjsWorkerSrc } from './pdfjs-node'

describe('pdfjs worker on Node (Vercel)', () => {
  it('resolves the legacy worker to a real file URL, not a relative path', () => {
    const src = resolvePdfjsWorkerSrc()
    expect(src.startsWith('file:')).toBe(true)
    expect(src.includes('pdf.worker.mjs')).toBe(true)
    expect(existsSync(fileURLToPath(src))).toBe(true)
  })

  it('pins GlobalWorkerOptions.workerSrc so the fake worker can import it', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    configurePdfjsWorker(pdfjs)
    expect(pdfjs.GlobalWorkerOptions.workerSrc.startsWith('file:')).toBe(true)
    expect(existsSync(fileURLToPath(pdfjs.GlobalWorkerOptions.workerSrc))).toBe(true)
  })

  it('inspects a one-page PDF without a fake-worker module miss', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([612, 792])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText('Hello', { x: 72, y: 720, size: 12, font })
    const bytes = await doc.save()
    const report = await inspectPdfPageSafety(Buffer.from(bytes), { runningMarksInBody: true })
    expect(report.ok).toBe(true)
    expect(report.pageCount).toBe(1)
  })

  it('traces the worker into the CMA PDF function bundle', () => {
    const src = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8')
    expect(src).toContain('pdfjs-dist/legacy/build/pdf.worker.mjs')
    expect(src).toContain("app/api/cma/[slug]/pdf/route")
  })
})
