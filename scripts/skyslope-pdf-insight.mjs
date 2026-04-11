/**
 * Structured PDF analysis for SkySlope Forms scripts (Node, ESM).
 *
 * **Standard for every PDF we analyze:** (1) Mozilla pdf.js per-page
 * extractText plus annotation inventory, (2) **OCR on every page** in the
 * read window (same page range), merged into a fixed two-part layout so
 * machine text and image text are never conflated. (3) Vendor and signature
 * heuristics run on the combined string.
 *
 * OCR engines per page (first success): Poppler `pdftoppm` + Tesseract CLI;
 * else pdf.js render + `tesseract.js`. See `.cursor/rules/skyslope-pdf-analysis.mdc`.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_MAX_PAGES = Math.min(
  120,
  Math.max(1, Number.parseInt(String(process.env.SKYSLOPE_PDF_MAX_PAGES || '80'), 10) || 80)
)

/**
 * @typedef {{
 *   ok: boolean
 *   reason?: string | undefined
 *   text: string
 *   pageCount: number
 *   pagesAnalyzed: number
 *   charCount: number
 *   nonWhitespaceCharCount: number
 *   textDensity: 'empty' | 'thin' | 'moderate' | 'rich'
 *   lowTextPageRanges: string
 *   annotationSubtypeCounts: Record<string, number>
 *   widgetSignLikeCount: number
 *   widgetFieldSample: string[]
 *   esign: Record<string, number>
 *   ocrSnippet: string
 *   ocrPageCount: number
 *   ocrPagesAttempted: number
 *   ocrEngineNote: string
 *   flagsLine: string
 *   combinedForSa: string
 * }} PdfInsight
 */

/**
 * @param {Buffer} buf
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<PdfInsight>}
 */
export async function analyzePdfBuffer(buf, opts = {}) {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
  if (!buf || buf.length < 8 || buf.slice(0, 4).toString() !== '%PDF') {
    return emptyPdfInsight('not_pdf_bytes')
  }

  let pdfjs
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch (e) {
    return emptyPdfInsight(`pdfjs_import:${e?.message || e}`)
  }

  /** @type {unknown} */
  let doc = null
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
      verbosity: 0,
      isEvalSupported: false,
    })
    doc = await loadingTask.promise
  } catch (e) {
    return emptyPdfInsight(`pdfjs_open:${e?.message || e}`)
  }

  const pageCount = doc.numPages || 0
  const pagesToRead = Math.min(pageCount, maxPages)
  const perPageChars = []
  const annotationSubtypeCounts = /** @type {Record<string, number>} */ ({})
  const widgetFieldSample = /** @type {string[]} */ []
  let widgetSignLikeCount = 0

  const pageTexts = []
  for (let i = 1; i <= pagesToRead; i++) {
    let pageChars = 0
    let pageText = ''
    try {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent({ includeMarkedContent: false })
      for (const item of textContent.items) {
        if (!item || typeof item !== 'object' || !('str' in item)) continue
        const s = String(/** @type {{ str: string }} */ (item).str || '')
        pageText += (pageText && !pageText.endsWith(' ') ? ' ' : '') + s
        pageChars += s.replace(/\s/g, '').length
      }
      let annotations = []
      try {
        annotations = await page.getAnnotations({ intent: 'display' })
      } catch {
        annotations = []
      }
      for (const a of annotations) {
        const sub = String(a?.subtype || 'unknown')
        annotationSubtypeCounts[sub] = (annotationSubtypeCounts[sub] || 0) + 1
        if (sub === 'Widget') {
          const name = [a.fieldName, a.title].filter(Boolean).join(' ').trim()
          if (name && /sign|initial|buyer|seller|agent|broker|firm|company|notary|date/i.test(name)) {
            widgetSignLikeCount += 1
            if (widgetFieldSample.length < 28 && !widgetFieldSample.includes(name)) widgetFieldSample.push(name)
          }
        }
      }
    } catch {
      pageText = ''
      pageChars = 0
    }
    perPageChars.push(pageChars)
    pageTexts.push(pageText)
  }

  let mergedPageTexts = pageTexts
  let ocrPageCount = 0
  let ocrPagesAttempted = 0
  let ocrSnippet = ''
  let ocrEngineNote = ''
  try {
    const ocrOut = await runMandatoryPageOcr(buf, doc, pagesToRead, pageTexts)
    mergedPageTexts = ocrOut.mergedPageTexts
    ocrPageCount = ocrOut.ocrPageCount
    ocrPagesAttempted = ocrOut.ocrPagesAttempted
    ocrSnippet = ocrOut.ocrSnippet
    ocrEngineNote = ocrOut.ocrEngineNote
  } catch (e) {
    console.error('[skyslope-pdf-insight] mandatory OCR phase failed', e)
    ocrEngineNote = `OCR failed: ${e?.message || String(e)}`
  }

  try {
    await doc.cleanup()
    await doc.destroy()
  } catch {
    /* ignore */
  }

  const text = mergedPageTexts.join('\n\n')
  const nonWhitespaceCharCount = text.replace(/\s/g, '').length
  const charCount = text.length
  const textDensity = densityLabel(nonWhitespaceCharCount, pageCount || pagesToRead)
  /** Text-layer only: where pdf.js saw little extractable text (diagnostic). */
  const lowTextPageRanges = formatLowTextPages(perPageChars)
  const esign = scanEsignMarkers(text)
  const combinedForSa = text

  const flagsLine = buildFlagsLine({
    pageCount,
    pagesAnalyzed: pagesToRead,
    textDensity,
    lowTextPageRanges,
    annotationSubtypeCounts,
    widgetSignLikeCount,
    esign,
    ocrPageCount,
    ocrPagesAttempted,
    ocrEngineNote,
    hasOcrSnippet: Boolean(ocrSnippet),
  })

  return {
    ok: true,
    text,
    pageCount,
    pagesAnalyzed: pagesToRead,
    charCount,
    nonWhitespaceCharCount,
    textDensity,
    lowTextPageRanges,
    annotationSubtypeCounts,
    widgetSignLikeCount,
    widgetFieldSample,
    esign,
    ocrSnippet,
    ocrPageCount,
    ocrPagesAttempted,
    ocrEngineNote,
    flagsLine,
    combinedForSa,
  }
}

/** Budgeted scripts skip some PDFs; keep table rows honest. */
export function notSampledPdfInsight() {
  return emptyPdfInsight('not_in_pdf_sample_for_this_run')
}

/**
 * @param {string} reason
 * @returns {PdfInsight}
 */
export function emptyPdfInsight(reason) {
  return {
    ok: false,
    reason,
    text: '',
    pageCount: 0,
    pagesAnalyzed: 0,
    charCount: 0,
    nonWhitespaceCharCount: 0,
    textDensity: 'empty',
    lowTextPageRanges: '',
    annotationSubtypeCounts: {},
    widgetSignLikeCount: 0,
    widgetFieldSample: [],
    esign: {},
    ocrSnippet: '',
    ocrPageCount: 0,
    ocrPagesAttempted: 0,
    ocrEngineNote: '',
    flagsLine:
      reason === 'not_in_pdf_sample_for_this_run'
        ? 'PDF not analyzed this run. Raise SKYSLOPE_BRIEF_MAX_PDFS to include more files.'
        : reason === 'no_download_url'
          ? 'No download URL on the document row'
          : reason === 'not_pdf'
            ? 'Not a PDF'
            : reason
              ? `Unreadable PDF (${reason})`
              : 'Unreadable PDF',
    combinedForSa: '',
  }
}

/**
 * @param {number} chars
 * @param {number} pages
 */
function densityLabel(chars, pages) {
  const p = Math.max(1, pages)
  const per = chars / p
  if (chars < 20) return 'empty'
  if (per < 120) return 'thin'
  if (per < 900) return 'moderate'
  return 'rich'
}

/**
 * @param {number[]} perPageChars
 */
function formatLowTextPages(perPageChars) {
  const thinIdx = []
  for (let i = 0; i < perPageChars.length; i++) {
    if (perPageChars[i] < 45) thinIdx.push(i + 1)
  }
  if (!thinIdx.length) return ''
  return collapseRanges(thinIdx)
}

/**
 * @param {number[]} sortedUnique
 */
function collapseRanges(sortedUnique) {
  const parts = []
  let start = sortedUnique[0]
  let prev = sortedUnique[0]
  for (let i = 1; i <= sortedUnique.length; i++) {
    const cur = sortedUnique[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }
  return `Low pdf.js text layer on page(s) ${parts.join(', ')} (see dual OCR block per page below)`
}

/**
 * @param {string} t
 */
function scanEsignMarkers(t) {
  const s = String(t || '')
  const counts = {
    digiSign: (s.match(/\bDigiSign\b/gi) || []).length,
    docusign: (s.match(/\bDocuSign\b|\bDOCUSIGN\b|Completed with DocuSign|Envelope ID\s*:/gi) || []).length,
    adobe: (s.match(/\bAdobe\s+Sign\b|\bAcrobat\s+Sign\b/gi) || []).length,
    oneSpan: (s.match(/OneSpan|SILANIS|eSignLive/gi) || []).length,
    rightSignature: (s.match(/RightSignature/gi) || []).length,
    proof: (s.match(/\bNotarize\b|\bProof\.com\b/gi) || []).length,
    genericSignedBy: (s.match(/Signed\s+by\s*:/gi) || []).length,
    digitalCert: (s.match(/Digitally\s+signed\s+by|Reason:\s|Location:\s/gi) || []).length,
  }
  return counts
}

/**
 * @param {object} p
 */
function buildFlagsLine(p) {
  const parts = []
  parts.push(`${p.pageCount} pg`)
  if (p.pagesAnalyzed < p.pageCount) parts.push(`read ${p.pagesAnalyzed}`)
  parts.push(p.textDensity)
  if (p.lowTextPageRanges) parts.push(shorten(p.lowTextPageRanges, 120))
  if (p.widgetSignLikeCount > 0) parts.push(`${p.widgetSignLikeCount} sign-like fields`)
  const e = p.esign || {}
  const hits = []
  if (e.digiSign) hits.push(`Digi×${e.digiSign}`)
  if (e.docusign) hits.push(`Docu×${e.docusign}`)
  if (e.adobe) hits.push(`Adobe×${e.adobe}`)
  if (e.oneSpan) hits.push(`OneSpan×${e.oneSpan}`)
  if (e.rightSignature) hits.push(`RS×${e.rightSignature}`)
  if (e.proof) hits.push(`Notary×${e.proof}`)
  if (e.genericSignedBy) hits.push(`SignedBy×${e.genericSignedBy}`)
  if (e.digitalCert) hits.push(`DigCert×${e.digitalCert}`)
  if (hits.length) parts.push(hits.join(' '))
  const ocrAtt = p.ocrPagesAttempted ?? 0
  if (ocrAtt > 0) {
    parts.push(`dual pipeline ${ocrAtt} pg`)
    if ((p.ocrPageCount ?? 0) !== ocrAtt) parts.push(`OCR nonempty ${p.ocrPageCount ?? 0}/${ocrAtt} pg`)
  }
  if (p.ocrEngineNote) parts.push(shorten(p.ocrEngineNote, 100))
  else if (p.hasOcrSnippet) parts.push('OCR text merged')
  const line = parts.join(' · ')
  return shorten(line, 380)
}

/**
 * @param {string} s
 * @param {number} n
 */
function shorten(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return t.slice(0, n - 1) + '…'
}

function commandOnPath(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' })
  return r.status === 0
}

/**
 * Unambiguous dual pipeline for **every** analyzed page: pdf.js text layer
 * plus mandatory rendered-page OCR (same page index). No conditional skip
 * based on text density. Page cap = min(pages read, SKYSLOPE_PDF_OCR_MAX_PAGES
 * when set; otherwise every page we read).
 * @param {Buffer} buf
 * @param {unknown} doc pdf.js document (still open)
 * @param {number} pagesToRead
 * @param {string[]} pageTexts raw extractText per page (same length as pagesToRead)
 */
async function runMandatoryPageOcr(buf, doc, pagesToRead, pageTexts) {
  const envCap = process.env.SKYSLOPE_PDF_OCR_MAX_PAGES
  const ocrEngineLimit =
    envCap != null && String(envCap).trim() !== ''
      ? Math.min(pagesToRead, Math.max(1, Number.parseInt(String(envCap), 10) || pagesToRead))
      : pagesToRead

  /** @type {string[]} */
  const merged = []

  if (pagesToRead === 0) {
    return {
      mergedPageTexts: [],
      ocrPageCount: 0,
      ocrPagesAttempted: 0,
      ocrSnippet: '',
      ocrEngineNote: 'zero pages in PDF read window',
    }
  }

  const useCli = commandOnPath('pdftoppm') && commandOnPath('tesseract')
  /** @type {import('tesseract.js').Worker | null} */
  let worker = null
  const ensureWorker = async () => {
    if (worker) return worker
    try {
      const Tesseract = await import('tesseract.js')
      worker = await Tesseract.createWorker('eng', 1, { logger: () => {} })
      return worker
    } catch (e) {
      console.error('[skyslope-pdf-insight] tesseract.js worker failed', e)
      return null
    }
  }

  if (!useCli) {
    await ensureWorker()
  }

  const engineMissingNote =
    'OCR engine unavailable (install Poppler + Tesseract CLI, or reinstall node deps for tesseract.js).'

  if (!useCli && !worker) {
    for (let p = 1; p <= pagesToRead; p++) {
      merged.push(
        formatPageDualPipeline(
          p,
          pageTexts[p - 1] || '',
          `${engineMissingNote} Render OCR did not run.`
        )
      )
    }
    return {
      mergedPageTexts: merged,
      ocrPageCount: 0,
      ocrPagesAttempted: pagesToRead,
      ocrSnippet: '',
      ocrEngineNote: engineMissingNote,
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-pdf-ocr-'))
  const pdfPath = path.join(tmp, 'in.pdf')
  fs.writeFileSync(pdfPath, buf)

  const ocrChunks = []
  let ocrPageCount = 0
  let usedCli = 0
  let usedRender = 0

  try {
    for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
      const layer = pageTexts[pageNum - 1] || ''

      if (pageNum > ocrEngineLimit) {
        merged.push(
          formatPageDualPipeline(
            pageNum,
            layer,
            `(OCR engine not run on this page: SKYSLOPE_PDF_OCR_MAX_PAGES caps passes at ${ocrEngineLimit} of ${pagesToRead} pages read)`
          )
        )
        continue
      }

      let ocrText = ''
      if (useCli) {
        ocrText = ocrOnePageWithCli(pdfPath, tmp, pageNum)
        if (ocrText.trim()) usedCli += 1
      }
      if (!ocrText.trim()) {
        const w = await ensureWorker()
        if (w) {
          ocrText = await ocrOnePageWithRender(doc, pageNum, w)
          if (ocrText.trim()) usedRender += 1
        }
      }
      if (ocrText.trim()) ocrPageCount += 1

      merged.push(formatPageDualPipeline(pageNum, layer, ocrText))
      ocrChunks.push(`[p${pageNum}] ${String(ocrText).replace(/\s+/g, ' ').trim().slice(0, 1500)}`)
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        /* ignore */
      }
    }
  }

  const ocrSnippet = ocrChunks.join('\n')
  const trimmedSnippet = ocrSnippet.length > 4000 ? ocrSnippet.slice(0, 4000) + '…' : ocrSnippet
  const engine =
    usedCli > 0 && usedRender > 0
      ? 'Poppler+Tesseract CLI and tesseract.js render'
      : usedCli > 0
        ? 'Poppler + Tesseract CLI'
        : usedRender > 0
          ? 'tesseract.js (pdf.js render)'
          : 'OCR engine ran; no nonempty OCR text'

  const capNote =
    ocrEngineLimit < pagesToRead
      ? ` Cap left ${pagesToRead - ocrEngineLimit} page(s) with engine-skip message in OCR block.`
      : ''

  return {
    mergedPageTexts: merged,
    ocrPageCount,
    ocrPagesAttempted: pagesToRead,
    ocrSnippet: trimmedSnippet,
    ocrEngineNote: `${engine} · nonempty OCR ${ocrPageCount}/${ocrEngineLimit} engine page(s).${capNote}`,
  }
}

/**
 * Fixed layout so machine text and image OCR are never mixed without labels.
 * @param {number} pageNum 1-based
 * @param {string} layerText
 * @param {string} ocrText
 */
function formatPageDualPipeline(pageNum, layerText, ocrText) {
  const layer = String(layerText || '').trim()
  const ocr = String(ocrText || '').trim()
  return [
    `<<< Page ${pageNum} >>>`,
    '--- MACHINE TEXT LAYER (pdf.js extractText) ---',
    layer.length ? layer : '(no extractable characters in text layer)',
    '--- RENDERED IMAGE OCR (mandatory same-page pass) ---',
    ocr.length ? ocr : '(no OCR characters returned for this page)',
  ].join('\n')
}

/**
 * @param {string} pdfPath
 * @param {string} tmpDir
 * @param {number} pageNum 1-based
 */
function ocrOnePageWithCli(pdfPath, tmpDir, pageNum) {
  const stem = path.join(tmpDir, `pg${pageNum}`)
  const r1 = spawnSync(
    'pdftoppm',
    ['-f', String(pageNum), '-l', String(pageNum), '-png', '-r', '200', pdfPath, stem],
    { encoding: 'utf8' }
  )
  if (r1.status !== 0) return ''
  const hits = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith(`pg${pageNum}-`) && f.endsWith('.png'))
    .sort()
  const fname = hits[0]
  if (!fname) return ''
  const pngPath = path.join(tmpDir, fname)
  try {
    const r2 = spawnSync('tesseract', [pngPath, 'stdout', '-l', 'eng'], { encoding: 'utf8', maxBuffer: 6_000_000 })
    return r2.status === 0 && r2.stdout ? String(r2.stdout) : ''
  } finally {
    try {
      fs.unlinkSync(pngPath)
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {unknown} doc
 * @param {number} pageNum
 * @param {import('tesseract.js').Worker} worker
 */
async function ocrOnePageWithRender(doc, pageNum, worker) {
  try {
    const { createCanvas } = await import('@napi-rs/canvas')
    const dpi = Math.min(300, Math.max(144, Number.parseInt(String(process.env.SKYSLOPE_PDF_OCR_DPI || '200'), 10) || 200))
    const scale = dpi / 72
    const page = await /** @type {{ getPage: (n: number) => Promise<unknown> }} */ (doc).getPage(pageNum)
    const p = /** @type {{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }} */ (
      page
    )
    const viewport = p.getViewport({ scale })
    const w = Math.max(1, Math.ceil(viewport.width))
    const h = Math.max(1, Math.ceil(viewport.height))
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    await p.render({ canvasContext: ctx, viewport }).promise
    const png = canvas.toBuffer('image/png')
    const {
      data: { text },
    } = await worker.recognize(png)
    return String(text || '')
  } catch (e) {
    console.error(`[skyslope-pdf-insight] render OCR failed page ${pageNum}`, e?.message || e)
    return ''
  }
}

/**
 * @param {string} text
 * @param {number} [max]
 */
export function extractSignatoryHints(text, max = 10) {
  const raw = String(text || '').replace(/\s+/g, ' ')
  const t = redactContacts(raw)
  const names = new Set()

  const patterns = [
    /\bDigiSign Verified[^\n]{0,100}?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
    /\bSigned\s+by\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /\bDigitally\s+signed\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /\(c\)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*Signature/gi,
    /\bDocuSigned\s+by\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(t)) !== null) {
      const n = m[1]?.trim()
      if (n && n.length < 60 && !/Verified|DigiSign|DocuSigned|Signature/i.test(n)) names.add(n)
      if (names.size >= max) return [...names]
    }
  }
  return [...names].slice(0, max)
}

/**
 * @param {string} s
 */
function redactContacts(s) {
  if (!s || typeof s !== 'string') return s
  return s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
}

/**
 * @param {string} text
 */
export function extractSaleAgreementNumber(text) {
  const t = String(text || '').replace(/\s+/g, ' ')
  const patterns = [
    /SALE\s+AGREEMENT\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /Sale\s+Agreement\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /RSA\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /Transaction\s*ID\s*[:#]?\s*([A-Za-z0-9\-._]+)/i,
    /\bSA\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /\bContract\s*#\s*([A-Za-z0-9\-._/]+)/i,
    /Agreement\s+(?:No\.?|Number|#)\s*[:#]?\s*([A-Za-z0-9\-._/]+)/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) return m[1].slice(0, 120).trim()
  }
  return ''
}

/**
 * @param {string} kind
 * @param {PdfInsight} insight
 * @param {string} fileName
 */
export function buildExecutionAssessment(kind, insight, fileName) {
  if (insight.reason === 'not_in_pdf_sample_for_this_run') {
    return {
      label: 'PDF not in this run sample',
      detail: insight.flagsLine || 'Raise SKYSLOPE_BRIEF_MAX_PDFS and re-run to analyze this file.',
    }
  }
  if (insight.reason === 'no_download_url') {
    return {
      label: 'No SkySlope download URL',
      detail: 'Open this document from the folder in SkySlope. The API row had no URL for automated read.',
    }
  }

  const fn = String(fileName || '')
  const t = `${insight.text || ''}\n${insight.ocrSnippet || ''}\n${fn}`
  const es = insight.esign || {}
  const vendorHits =
    (es.digiSign || 0) +
    (es.docusign || 0) +
    (es.adobe || 0) +
    (es.oneSpan || 0) +
    (es.rightSignature || 0) +
    (es.proof || 0) +
    (es.genericSignedBy || 0) +
    (es.digitalCert || 0)
  const hasSigLabels = /Seller Initial|Buyer Initial|Signature|By:|Initial here|Sign here/i.test(t)
  const thin = insight.textDensity === 'empty' || insight.textDensity === 'thin'
  const widgets = insight.widgetSignLikeCount || 0

  const detailParts = []
  if (insight.pageCount) detailParts.push(`${insight.pageCount} page PDF, ${insight.textDensity} extractable text`)
  if (insight.lowTextPageRanges) detailParts.push(insight.lowTextPageRanges)
  if (widgets > 0) detailParts.push(`${widgets} form field(s) look signature or party related in the PDF structure`)
  if (vendorHits > 0) detailParts.push('E-sign or certificate language appeared in text or OCR')
  detailParts.push('Confirm every required line in SkySlope. Automated read is advisory only')

  const baseDetail = detailParts.join('. ') + '.'

  if (kind === 'listing_agreement' || kind === 'agency_disclosure_pamphlet') {
    if (!insight.ok) return { label: 'PDF could not be analyzed', detail: insight.flagsLine || 'Open in SkySlope.' }
    if (thin && vendorHits === 0 && !widgets)
      return {
        label: 'Little machine readable text',
        detail:
          'Per-page text extraction is thin and no e-sign markers or signature widgets stood out. The file may be mostly scans or images. ' + baseDetail,
      }
    if (vendorHits >= 2 || widgets >= 2 || (vendorHits >= 1 && hasSigLabels))
      return {
        label: 'Strong clues of seller side activity',
        detail:
          'Multiple e-sign markers, certificate language, or signature-like form fields suggest activity on seller or firm lines. ' + baseDetail,
      }
    if (vendorHits >= 1 || hasSigLabels || widgets >= 1)
      return {
        label: 'Some execution clues in text or fields',
        detail: 'At least one vendor stamp, signature wording, or structured field suggests partial progress. ' + baseDetail,
      }
    return { label: 'No strong automated signal', detail: 'Use your checklist on the PDF. ' + baseDetail }
  }

  if (kind === 'buyer_representation_agreement') {
    if (!insight.ok) return { label: 'PDF could not be analyzed', detail: insight.flagsLine || 'Open in SkySlope.' }
    if (thin && vendorHits === 0 && !widgets)
      return {
        label: 'Little machine readable text',
        detail:
          'Thin text layer on this buyer-side form. Treat as needs eye review if scans. ' + baseDetail,
      }
    if (vendorHits >= 1 || widgets >= 1)
      return {
        label: 'Buyer side activity plausible',
        detail: 'E-sign text or buyer-related widgets appeared. Confirm buyer and firm signatures. ' + baseDetail,
      }
    return { label: 'No strong automated signal', detail: 'Open the PDF for buyer and firm execution. ' + baseDetail }
  }

  if (
    kind === 'buyer_offer_or_package' ||
    kind === 'sale_agreement_or_rsa' ||
    kind === 'numbered_counter' ||
    kind === 'counter_or_counteroffer' ||
    kind === 'addendum'
  ) {
    if (!insight.ok) return { label: 'PDF could not be analyzed', detail: insight.flagsLine || 'Open in SkySlope.' }
    if (thin && vendorHits < 2 && widgets < 2)
      return {
        label: 'Offer stack may be scan heavy',
        detail:
          'Low extractable text per page on this contract-class PDF. Mutual acceptance still requires you to open the file. ' + baseDetail,
      }
    if (vendorHits >= 5 || (vendorHits >= 3 && hasSigLabels) || widgets >= 4)
      return {
        label: 'Heavy e-sign or field activity',
        detail:
          'Many vendor markers or signature-class widgets suggest multiple parties touched the file. Map stamps to buyer, seller, and firm blocks. ' +
          baseDetail,
      }
    if (vendorHits >= 2 || widgets >= 2)
      return {
        label: 'Moderate e-sign or field activity',
        detail: 'Several markers or widgets. Check initials and counter pages. ' + baseDetail,
      }
    if (vendorHits >= 1 || widgets >= 1 || hasSigLabels)
      return { label: 'Light execution clues', detail: 'Some markers only. Treat as partial signal. ' + baseDetail }
    return { label: 'No strong automated signal', detail: 'Open the PDF for all required initials and signatures. ' + baseDetail }
  }

  if (kind === 'lender_financing') {
    return {
      label: 'Lender or buyer form',
      detail: 'Usually buyer or lender signs. ' + (insight.flagsLine || ''),
    }
  }
  return { label: 'Review in SkySlope', detail: insight.flagsLine || 'Classify using the form title and office checklist.' }
}
