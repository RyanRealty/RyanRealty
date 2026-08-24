/**
 * Translate SkySlope form-version `fields` + `pages` into our envelope field_map
 * (handoff docs/TC_FORMS_LOADING_HANDOFF.md §2). Pure + testable — no I/O.
 *
 * Geometry: SkySlope gives point coords + page dims; we store fractional,
 * top-left geometry (the lib/tc/signing.ts convention): x/w over page width,
 * y/h over page height, page = pageNumber + 1 (SkySlope pageNumber is 0-indexed).
 */

import type { SignFieldType } from './signing'

export interface SkySlopeSourceField {
  type?: string
  originalType?: string
  dataRef?: string
  format?: string
  group?: string
  order?: number
  xCoordinate?: number
  yCoordinate?: number
  width?: number
  height?: number
  pageNumber?: number
  isOptional?: boolean
  originalName?: string
  domainName?: string
}

export interface SkySlopeSourcePage {
  width?: number
  height?: number
}

// Canonical signing field types live in ./signing.ts (SIGN_FIELD_TYPES, kept in
// lock-step with the tc_envelope_fields.type CHECK). The mapper MUST emit only
// those — this alias makes emitting a non-canonical type (e.g. the old 'date',
// which the DB CHECK rejects) a COMPILE error instead of a runtime template break.
export type MappedFieldType = SignFieldType
export type SignerRole = 'buyer' | 'seller' | 'listing_agent' | 'buyer_agent' | null

export interface MappedField {
  type: MappedFieldType
  page: number
  x: number
  y: number
  w: number
  h: number
  dataRef: string | null
  signerRole: SignerRole
  optional: boolean
  label: string | null
}

const TYPE_MAP: Record<string, MappedFieldType> = {
  Signature: 'signature',
  Initials: 'initials',
  DateSigned: 'date_signed',
  TimeSigned: 'time_signed',
  Date: 'date_signed',
  FullName: 'full_name',
  fullname: 'full_name',
  checkboxblock: 'checkbox',
  Strike: 'strike',
  strike: 'strike',
  Highlight: 'highlight',
  highlight: 'highlight',
}

function mapType(t?: string): MappedFieldType {
  return (t ? TYPE_MAP[t] : undefined) ?? 'text'
}

/** AcroForm widgets are often Text even when the name is BuyerSignature. */
export function mappedFieldTypeFromName(
  dataRef?: string | null,
  label?: string | null,
  current: MappedFieldType = 'text',
): MappedFieldType {
  if (current !== 'text') return current
  const joined = `${dataRef ?? ''} ${label ?? ''}`.trim()
  if (!joined) return current
  // Legal paragraphs ("By signing below the delivering Party…") are not widgets.
  if (joined.length > 60) return current
  const s = joined.toLowerCase()
  if (/\bsigning\b/.test(s) && !/\bsignature\b/.test(s)) return current
  if (/initial/.test(s)) return 'initials'
  if (/date\s*signed|datesigned|date_signed/.test(s)) return 'date_signed'
  if (/time\s*signed|timesigned|time_signed/.test(s)) return 'time_signed'
  if (/full\s*name|fullname/.test(s)) return 'full_name'
  if (/\bsignature\b|signatur|_sig(?:nature)?\b/.test(s)) return 'signature'
  if (/(?:^|[^a-z])sign(?:ature)?(?:[^a-z]|$)/.test(s) && !/assign|design|signal|significant/.test(s)) {
    return 'signature'
  }
  return current
}

/** Derive which recipient signs a signature/initials field from its dataRef/group. */
export function deriveSignerRole(dataRef?: string, group?: string): SignerRole {
  const s = `${dataRef ?? ''} ${group ?? ''}`.toLowerCase()
  if (/buyer'?s?[\s_-]*agent|buyersagent|selling[\s_-]*agent/.test(s)) return 'buyer_agent'
  if (/listing[\s_-]*agent|seller'?s?[\s_-]*agent|sellersagent/.test(s)) return 'listing_agent'
  if (/receiv/.test(s)) return 'buyer'
  if (/deliver/.test(s)) return 'seller'
  if (/buyer/.test(s)) return 'buyer'
  if (/seller/.test(s)) return 'seller'
  return null
}

const DEFAULT_PAGE = { width: 612, height: 792 } // US Letter points

export function translateSkyslopeFields(
  fields: SkySlopeSourceField[] | null | undefined,
  pages: SkySlopeSourcePage[] | null | undefined,
): MappedField[] {
  const safeFields = Array.isArray(fields) ? fields : []
  const safePages = Array.isArray(pages) ? pages : []
  return safeFields.map((f) => {
    const pg = safePages[f.pageNumber ?? 0] ?? safePages[0] ?? DEFAULT_PAGE
    const W = pg.width || DEFAULT_PAGE.width
    const H = pg.height || DEFAULT_PAGE.height
    const type = mappedFieldTypeFromName(
      f.dataRef,
      f.originalName ?? f.domainName,
      mapType(f.type ?? f.originalType),
    )
    return {
      type,
      page: (f.pageNumber ?? 0) + 1,
      x: clamp01((f.xCoordinate ?? 0) / W),
      y: clamp01((f.yCoordinate ?? 0) / H),
      w: clamp01((f.width ?? 0) / W),
      h: clamp01((f.height ?? 0) / H),
      dataRef: f.dataRef ? `${f.dataRef}${f.format ?? ''}` : null,
      signerRole: deriveSignerRole(
        [f.dataRef, f.originalName, f.domainName].filter(Boolean).join(' '),
        f.group,
      ),
      optional: !!f.isOptional,
      label: f.originalName ?? f.domainName ?? null,
    }
  })
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Counts for the ingest response / smoke-test acceptance. */
export function summarizeMap(map: MappedField[]): {
  total: number
  signature: number
  initials: number
  date_signed: number
  text: number
  checkbox: number
  strike: number
} {
  return {
    total: map.length,
    signature: map.filter((m) => m.type === 'signature').length,
    initials: map.filter((m) => m.type === 'initials').length,
    date_signed: map.filter((m) => m.type === 'date_signed').length,
    text: map.filter((m) => m.type === 'text').length,
    checkbox: map.filter((m) => m.type === 'checkbox').length,
    strike: map.filter((m) => m.type === 'strike').length,
  }
}
