/**
 * What a PDF's text layer says about its structure, before anyone looks at it.
 * Pure. The I/O that produces the per-page input lives in ./pdf-pages.ts.
 *
 * Three jobs:
 *  1. Split a PDF into the forms it holds. A SkySlope or DocuSign packet is
 *     often several forms in one file, and two copies of the same form can be
 *     stapled together. The OREF footer stamp ("OREF 001 | Released 01/2025 |
 *     Page 14 of 15") is the reliable marker; a mention of "OREF 003" in the
 *     body of a sale agreement is NOT a second form.
 *  2. Find the pages worth looking at: the first page of each form (what it
 *     is, which number, who the parties are) and the pages carrying signature
 *     lines. Everything else is contract language the reader never needs.
 *  3. Record e-sign evidence the text layer does carry (DocuSign envelope id,
 *     DigiSign envelope id from the link annotation, dotloop, Authentisign).
 *     Signatures themselves are images and are only visible to the reader.
 */

export type PageText = {
  page: number
  text: string
  /** Contents of link / widget annotations (DigiSign writes its envelope id here). */
  annotations?: string[]
}

export type EsignMark = {
  vendor: 'docusign' | 'digisign' | 'dotloop' | 'authentisign' | 'adobe_sign' | 'vault'
  envelopeId: string | null
}

export type PageFacts = {
  page: number
  textChars: number
  oref: { number: string; released: string | null; index: number | null; total: number | null } | null
  /** "Page 3 of 4" when there is no OREF stamp. */
  pageOf: { index: number; total: number } | null
  /** Printed signature lines ("Buyer ____ Print ____ Date"), by the label in front of them. */
  signatureLabels: string[]
  esign: EsignMark[]
}

export type Segment = {
  id: number
  pages: number[]
  oref: string | null
  released: string | null
  /** Pages the form says it has (the footer's "of N"). */
  declaredPages: number | null
}

export type Anatomy = {
  pageCount: number
  pages: PageFacts[]
  segments: Segment[]
  /** The text layer is missing or thin on most pages: a scan. */
  scanned: boolean
  esign: EsignMark[]
}

const OREF_STAMP = /OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released\s*(\d{1,2}\/\d{4})?\s*(?:\|\s*Page\s*(\d+)\s*of\s*(\d+))?/i
const PAGE_OF = /\bPage\s+(\d{1,3})\s+of\s+(\d{1,3})\b/i
/**
 * A label followed by a blank line meant for a signature. OREF prints them as
 * "Buyer ______ Print ______ Date ____"; other publishers use "Signature ____",
 * "Buyer Signature ____" or "X ____".
 */
const SIGNATURE_LINE =
  /\b((?:buyer|seller|purchaser|owner|tenant|landlord|licensee|broker|agent|principal\s+broker|escrow\s+officer|lender)(?:'s)?(?:\s+(?:agent|broker|signature))?|signature|signed)\b[\s:]*_{5,}/gi

const DOCUSIGN = /docusign\s+envelope\s+id:?\s*([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})/i
const DIGISIGN = /digisign\s+verified\s*-?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?/i
const DOTLOOP = /dotloop\s+(?:verified|signature\s+verification)[^\n]{0,60}?(dtlp\.us\/[A-Za-z0-9-]+)?/i
const AUTHENTISIGN = /authentisign\s+id:?\s*([0-9A-F-]{36})?/i
const ADOBE = /(?:adobe\s+(?:acrobat\s+)?sign|echosign)[^\n]{0,80}?(?:transaction\s+id:?\s*([A-Za-z0-9_-]{10,}))?/i
/** Our own seal's audit page (lib/tc/seal-pdf.ts). */
const VAULT_SEAL = /certificate\s+of\s+completion[\s\S]{0,400}ryan\s+realty/i

/** Pages with fewer characters than this carry no usable text layer. */
const THIN_TEXT = 200

function esignOn(text: string, annotations: readonly string[]): EsignMark[] {
  const out: EsignMark[] = []
  const hay = `${text}\n${annotations.join('\n')}`
  const ds = hay.match(DOCUSIGN)
  if (ds) out.push({ vendor: 'docusign', envelopeId: ds[1].toUpperCase() })
  const dg = hay.match(DIGISIGN)
  if (dg) out.push({ vendor: 'digisign', envelopeId: dg[1]?.toLowerCase() ?? null })
  const dl = hay.match(DOTLOOP)
  if (dl) out.push({ vendor: 'dotloop', envelopeId: dl[1] ?? null })
  const au = hay.match(AUTHENTISIGN)
  if (au) out.push({ vendor: 'authentisign', envelopeId: au[1]?.toUpperCase() ?? null })
  const ad = hay.match(ADOBE)
  if (ad) out.push({ vendor: 'adobe_sign', envelopeId: ad[1] ?? null })
  if (VAULT_SEAL.test(text)) out.push({ vendor: 'vault', envelopeId: null })
  return out
}

export function pageFacts(input: PageText): PageFacts {
  const text = input.text ?? ''
  const stamp = text.match(OREF_STAMP)
  const pageOf = text.match(PAGE_OF)
  const labels: string[] = []
  const re = new RegExp(SIGNATURE_LINE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) labels.push(m[1].replace(/\s+/g, ' ').trim())
  return {
    page: input.page,
    textChars: text.replace(/\s+/g, '').length,
    oref: stamp
      ? {
          number: stamp[1].toUpperCase(),
          released: stamp[2] ?? null,
          index: stamp[3] ? Number(stamp[3]) : null,
          total: stamp[4] ? Number(stamp[4]) : null,
        }
      : null,
    pageOf: pageOf ? { index: Number(pageOf[1]), total: Number(pageOf[2]) } : null,
    signatureLabels: labels,
    esign: esignOn(text, input.annotations ?? []),
  }
}

/**
 * Split pages into forms. A new form starts when the OREF number changes, or
 * the same number restarts at page 1 (a second copy stapled on). A page with
 * no stamp stays with the form before it (an exhibit or a signature
 * certificate), unless it restarts a "Page 1 of N" count of its own.
 */
export function segmentPages(pages: readonly PageFacts[]): Segment[] {
  const out: Segment[] = []
  let cur: Segment | null = null
  for (const p of pages) {
    const stamp = p.oref
    let startNew = !cur
    if (cur && stamp) {
      if (stamp.number !== cur.oref) startNew = true
      else if (stamp.index === 1 && cur.pages.length > 0) startNew = true
    } else if (cur && !stamp && p.pageOf?.index === 1 && cur.pages.length > 0) {
      startNew = true
    } else if (cur && !stamp && cur.oref && cur.declaredPages && cur.pages.length >= cur.declaredPages) {
      // The stamped form already has every page it declares; what follows is
      // something else stapled on (another publisher's form, a certificate).
      startNew = true
    }
    if (startNew) {
      cur = {
        id: out.length + 1,
        pages: [],
        oref: stamp?.number ?? null,
        released: stamp?.released ?? null,
        declaredPages: stamp?.total ?? p.pageOf?.total ?? null,
      }
      out.push(cur)
    }
    cur!.pages.push(p.page)
  }
  return out
}

export function readAnatomy(pages: readonly PageText[]): Anatomy {
  const facts = pages.map(pageFacts)
  const thin = facts.filter((f) => f.textChars < THIN_TEXT).length
  const esign: EsignMark[] = []
  for (const f of facts) {
    for (const e of f.esign) {
      if (!esign.some((x) => x.vendor === e.vendor && x.envelopeId === e.envelopeId)) esign.push(e)
    }
  }
  return {
    pageCount: pages.length,
    pages: facts,
    segments: segmentPages(facts),
    scanned: pages.length > 0 && thin / pages.length > 0.5,
    esign,
  }
}

export type PagePick = { page: number; segment: number; why: 'first' | 'signature' | 'last' | 'scan' }

/** Images the reader looks at per document. A packet over this is read in several passes. */
export const MAX_PAGES_PER_PASS = 8
/** Past this many pages in total the document is a report or a scan dump; read its identity only. */
export const MAX_PAGES_PER_DOCUMENT = 24

/**
 * The pages to show the reader, in page order.
 * Per form: its first page, every page with a printed signature line, and its
 * last page when no line was found in text (signature blocks sit at the end).
 * A scanned form (no text) shows its first page and last two.
 */
export function pickPages(anatomy: Anatomy): PagePick[] {
  const byPage = new Map(anatomy.pages.map((p) => [p.page, p]))
  const picks = new Map<number, PagePick>()
  const add = (page: number, segment: number, why: PagePick['why']) => {
    if (!picks.has(page)) picks.set(page, { page, segment, why })
  }
  for (const seg of anatomy.segments) {
    const first = seg.pages[0]
    const last = seg.pages[seg.pages.length - 1]
    add(first, seg.id, 'first')
    const segScanned = seg.pages.every((n) => (byPage.get(n)?.textChars ?? 0) < THIN_TEXT)
    if (segScanned) {
      for (const n of seg.pages.slice(-2)) add(n, seg.id, 'scan')
      continue
    }
    const withLines = seg.pages.filter((n) => (byPage.get(n)?.signatureLabels.length ?? 0) > 0)
    for (const n of withLines) add(n, seg.id, 'signature')
    if (!withLines.length && seg.pages.length > 1) add(last, seg.id, 'last')
  }
  const ordered = [...picks.values()].sort((a, b) => a.page - b.page)
  if (ordered.length <= MAX_PAGES_PER_DOCUMENT) return ordered
  // A huge file: keep every form's first page, then signature pages in order.
  const firsts = ordered.filter((p) => p.why === 'first')
  const rest = ordered.filter((p) => p.why !== 'first')
  return [...firsts, ...rest].slice(0, MAX_PAGES_PER_DOCUMENT).sort((a, b) => a.page - b.page)
}

/**
 * Group picked pages into reader passes of at most MAX_PAGES_PER_PASS images,
 * never splitting one form's pages across passes when it fits in one.
 */
export function passesFor(picks: readonly PagePick[]): PagePick[][] {
  const bySegment = new Map<number, PagePick[]>()
  for (const p of picks) bySegment.set(p.segment, [...(bySegment.get(p.segment) ?? []), p])
  const passes: PagePick[][] = []
  let cur: PagePick[] = []
  for (const group of bySegment.values()) {
    if (cur.length + group.length > MAX_PAGES_PER_PASS && cur.length) {
      passes.push(cur)
      cur = []
    }
    for (const p of group) {
      if (cur.length >= MAX_PAGES_PER_PASS) {
        passes.push(cur)
        cur = []
      }
      cur.push(p)
    }
  }
  if (cur.length) passes.push(cur)
  return passes
}
