/**
 * TC envelope sealer — server-only.
 *
 * Flattens completed signature/text/date/checkbox values onto the source
 * PDF(s), merges them into one executed document, and appends a tamper-evident
 * audit-certificate page (ESIGN / Oregon UETA, ORS ch. 84: intent, consent,
 * attribution, integrity, signer copy, retention). Returns the sealed bytes +
 * sha256 so the caller can store it as an executed tc_documents row.
 *
 * Geometry per lib/tc/signing.ts: fields are page-relative fractions, origin
 * top-left. pdf-lib uses bottom-left points — converted here, in ONE place.
 */
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { EnvelopeField, SignFieldValue } from './signing'

export type SealRecipientSummary = {
  name: string
  email: string
  roleLabel: string
  signingOrder: number
  consentedAt: string | null
  viewedAt: string | null
  completedAt: string | null
  ip: string | null
  userAgent: string | null
}

export type SealDocumentInput = {
  /** Source PDF bytes for one envelope document. */
  bytes: Uint8Array
  /** Original file name (for the certificate manifest). */
  name: string
  /** Completed fields belonging to THIS document. */
  fields: EnvelopeField[]
}

export type SealEnvelopeInput = {
  envelopeId: string
  envelopeName: string
  documents: SealDocumentInput[]
  recipients: SealRecipientSummary[]
  sealedAtIso: string
}

export type SealResult = { bytes: Uint8Array; sha256: string }

const NAVY = rgb(16 / 255, 39 / 255, 66 / 255)
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.4, 0.4)
const LINE = rgb(0.82, 0.82, 0.82)

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  try {
    return new Uint8Array(Buffer.from(dataUrl.slice(comma + 1), 'base64'))
  } catch {
    return null
  }
}

async function drawFieldValue(
  out: PDFDocument,
  page: PDFPage,
  field: EnvelopeField,
  value: SignFieldValue,
  font: PDFFont
): Promise<void> {
  const W = page.getWidth()
  const H = page.getHeight()
  const fx = field.x * W
  const fw = field.w * W
  const fh = field.h * H
  // y is fraction from TOP → pdf-lib bottom-left origin
  const fy = H - field.y * H - fh

  if ((value.kind === 'signature' || value.kind === 'initials') && value.png) {
    const bytes = dataUrlToBytes(value.png)
    if (!bytes) return
    try {
      const img = await out.embedPng(bytes)
      // contain within the box, preserve aspect
      const scale = Math.min(fw / img.width, fh / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      page.drawImage(img, { x: fx + (fw - dw) / 2, y: fy + (fh - dh) / 2, width: dw, height: dh })
    } catch {
      /* skip unembeddable image */
    }
    return
  }

  if (value.kind === 'date_signed' || value.kind === 'text') {
    const text = value.text ?? ''
    if (!text) return
    const size = Math.max(7, Math.min(12, fh * 0.7))
    page.drawText(text, { x: fx + 2, y: fy + (fh - size) / 2 + 1, size, font, color: INK })
    return
  }

  if (value.kind === 'checkbox' && value.checked) {
    const size = Math.max(8, Math.min(14, fh))
    page.drawText('X', { x: fx + (fw - size * 0.6) / 2, y: fy + (fh - size) / 2 + 1, size, font, color: INK })
  }
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  // keep it human + tabular: YYYY-MM-DD HH:MM UTC
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

export async function sealEnvelope(input: SealEnvelopeInput): Promise<SealResult> {
  const out = await PDFDocument.create()
  out.setTitle(input.envelopeName)
  out.setSubject(`Executed envelope ${input.envelopeId}`)
  out.setProducer('Ryan Realty TC')
  const helv = await out.embedFont(StandardFonts.Helvetica)
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold)

  const docHashes: { name: string; sha256: string }[] = []

  for (const doc of input.documents) {
    docHashes.push({ name: doc.name, sha256: createHash('sha256').update(doc.bytes).digest('hex') })
    let src: PDFDocument
    try {
      src = await PDFDocument.load(doc.bytes)
    } catch {
      continue // non-PDF / unreadable source — skip, manifest still records its hash
    }
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
    // overlay this document's fields onto the freshly added pages
    const firstNewPageIndex = out.getPageCount() - pages.length
    for (const field of doc.fields) {
      if (!field.value) continue
      const pageIdx = firstNewPageIndex + (field.page - 1)
      if (pageIdx < firstNewPageIndex || pageIdx >= out.getPageCount()) continue
      await drawFieldValue(out, out.getPage(pageIdx), field, field.value, helv)
    }
  }

  if (out.getPageCount() === 0) out.addPage() // never produce a zero-page PDF

  appendCertificate(out, helv, helvBold, input, docHashes)

  const bytes = await out.save()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return { bytes, sha256 }
}

function appendCertificate(
  out: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  input: SealEnvelopeInput,
  docHashes: { name: string; sha256: string }[]
): void {
  const page = out.addPage([612, 792]) // US Letter
  const M = 54
  let y = 792 - M

  const line = (text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = opts.size ?? 9
    page.drawText(text, { x: M, y, size, font: opts.bold ? bold : font, color: opts.color ?? INK })
    y -= (opts.gap ?? size + 6)
  }
  const rule = () => {
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: 612 - M, y: y + 4 }, thickness: 0.5, color: LINE })
    y -= 10
  }

  line('Certificate of Completion', { size: 16, bold: true, color: NAVY, gap: 24 })
  line('Ryan Realty — Transaction Coordination', { size: 9, color: MUTED, gap: 18 })

  line('Envelope', { bold: true, size: 9, gap: 13 })
  line(input.envelopeName, { size: 9, gap: 12 })
  line(`Envelope ID: ${input.envelopeId}`, { size: 8, color: MUTED, gap: 12 })
  line(`Sealed: ${fmt(input.sealedAtIso)}`, { size: 8, color: MUTED, gap: 16 })
  rule()

  line('Signers', { bold: true, size: 10, gap: 16 })
  for (const r of input.recipients) {
    line(`${r.name || '(unnamed)'} — ${r.roleLabel}`, { bold: true, size: 9, gap: 12 })
    line(`${r.email}    signing order ${r.signingOrder}`, { size: 8, color: MUTED, gap: 11 })
    line(`Consented: ${fmt(r.consentedAt)}    Viewed: ${fmt(r.viewedAt)}    Signed: ${fmt(r.completedAt)}`, {
      size: 8,
      color: MUTED,
      gap: 11,
    })
    line(`IP: ${r.ip ?? '—'}`, { size: 7, color: MUTED, gap: 8 })
    line(`Device: ${(r.userAgent ?? '—').slice(0, 90)}`, { size: 7, color: MUTED, gap: 14 })
  }
  rule()

  line('Documents (sha256 of source)', { bold: true, size: 10, gap: 15 })
  for (const d of docHashes) {
    line(d.name.slice(0, 70), { size: 8, gap: 10 })
    line(d.sha256, { size: 7, color: MUTED, gap: 14 })
  }
  rule()

  line('Legal basis', { bold: true, size: 9, gap: 13 })
  const legal =
    'Signed electronically under the federal ESIGN Act (15 USC 7001) and the Oregon Uniform ' +
    'Electronic Transactions Act (ORS ch. 84). Each signer consented to transact electronically, ' +
    'the signing link authenticated the signer (unique per-recipient token), and this record ' +
    'captures intent, attribution, timestamps, and tamper evidence (document hashes above). ' +
    'A completed copy was delivered to every party.'
  // simple word-wrap
  const words = legal.split(' ')
  let row = ''
  for (const w of words) {
    const test = row ? `${row} ${w}` : w
    if (font.widthOfTextAtSize(test, 8) > 612 - M * 2) {
      line(row, { size: 8, color: MUTED, gap: 11 })
      row = w
    } else {
      row = test
    }
  }
  if (row) line(row, { size: 8, color: MUTED, gap: 11 })
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
