/**
 * Compare a SkySlope published-form catalog (metadata only) to the forms we
 * already hold. Pure: no I/O. Used by the catalog-check apply path (T2.1b).
 *
 * SkySlope library ids were verified live 2026-06-13 against Matt's Forms
 * session (docs/TC_FORMS_LOADING_HANDOFF.md).
 */

export const OREGON_FORM_LIBRARIES = [
  { code: 'OREF', sourceLibraryId: '1340', name: 'Oregon Real Estate Forms' },
  { code: 'ODS', sourceLibraryId: '1528', name: 'Oregon Data Share' },
  { code: 'OR', sourceLibraryId: '1837', name: 'Oregon Realtors' },
] as const

export type OregonFormLibraryCode = (typeof OREGON_FORM_LIBRARIES)[number]['code']

export type FormDisposition = 'current' | 'updated' | 'new' | 'retired'

export type CatalogFormInput = {
  sourceFormId: string
  sourceVersionId: string
  name: string
  formNumber?: string | null
  pageCount?: number | null
  versionLabel?: string | null
}

export type HeldForm = {
  id: string
  sourceFormId: string | null
  sourceVersionId: string | null
  formNumber: string | null
  name: string
}

export type CatalogItemResult = {
  sourceFormId: string
  sourceVersionId: string
  name: string
  formNumber: string | null
  pageCount: number | null
  versionLabel: string | null
  disposition: FormDisposition
  heldFormVersionId: string | null
}

export type LibraryCatalogDiff = {
  items: CatalogItemResult[]
  counts: Record<FormDisposition, number>
}

const MAX_FORMS_PER_LIBRARY = 5000

export function parseFormNumber(name: string): string | null {
  const text = name.trim()
  const orefPrefix = text.match(/\bOREF[- ](\d{3}[A-Z]?)\b/i)
  if (orefPrefix) return orefPrefix[1].toUpperCase()
  const orefSuffix = text.match(/\b(\d{3}[A-Z]?)\s*[-–]?\s*OREF\b/i)
  if (orefSuffix) return orefSuffix[1].toUpperCase()
  const orNum = text.match(/^(\d{1,2}\.\d+[A-Z]?)\b/i)
  if (orNum) return orNum[1].toUpperCase()
  const lead = text.match(/^(\d{3}[A-Z]?)\b/)
  if (lead) return lead[1].toUpperCase()
  return null
}

export function parseVersionLabel(name: string): string | null {
  const dated = name.match(/\((\d{1,2}\/\d{4})\)/)
  if (dated) return dated[1]
  const rev = name.match(/\bRev\.?\s*([\d.]+)/i)
  if (rev) return rev[1]
  const ymd = name.match(/\b(20\d{2}-\d{2})\b/)
  if (ymd) return ymd[1]
  return null
}

export function normalizeFormNumber(n: string | null | undefined): string | null {
  if (!n) return null
  const t = n.trim().toUpperCase().replace(/^OREF[- ]/i, '')
  return t || null
}

function emptyCounts(): Record<FormDisposition, number> {
  return { current: 0, updated: 0, new: 0, retired: 0 }
}

function bump(counts: Record<FormDisposition, number>, d: FormDisposition) {
  counts[d] += 1
}

/**
 * Match a published catalog row to a held version.
 * Prefer SkySlope formId (stable across revisions). Fall back to form number
 * so locally registered samples still pair with the live published form.
 */
export function matchHeldForm(
  incoming: CatalogFormInput,
  held: HeldForm[],
  taken: Set<string>,
): HeldForm | null {
  const formId = incoming.sourceFormId.trim()
  if (formId) {
    const byId = held.find((h) => h.sourceFormId === formId && !taken.has(h.id))
    if (byId) return byId
  }
  const num =
    normalizeFormNumber(incoming.formNumber) ?? parseFormNumber(incoming.name)
  if (!num) return null
  return (
    held.find((h) => normalizeFormNumber(h.formNumber) === num && !taken.has(h.id)) ??
    null
  )
}

export function diffLibraryCatalog(
  incoming: CatalogFormInput[],
  held: HeldForm[],
): LibraryCatalogDiff {
  const counts = emptyCounts()
  const items: CatalogItemResult[] = []
  const taken = new Set<string>()
  const seenFormIds = new Set<string>()

  for (const raw of incoming) {
    const sourceFormId = String(raw.sourceFormId ?? '').trim()
    const sourceVersionId = String(raw.sourceVersionId ?? '').trim()
    const name = String(raw.name ?? '').trim()
    if (!sourceFormId || !sourceVersionId || !name) continue
    if (seenFormIds.has(sourceFormId)) continue
    seenFormIds.add(sourceFormId)

    const formNumber =
      normalizeFormNumber(raw.formNumber) ?? parseFormNumber(name)
    const versionLabel =
      (raw.versionLabel && String(raw.versionLabel).trim()) || parseVersionLabel(name)
    const pageCount =
      typeof raw.pageCount === 'number' && Number.isFinite(raw.pageCount)
        ? raw.pageCount
        : null

    const match = matchHeldForm(
      { ...raw, sourceFormId, sourceVersionId, name, formNumber },
      held,
      taken,
    )

    let disposition: FormDisposition
    if (!match) {
      disposition = 'new'
    } else {
      taken.add(match.id)
      const heldVersion = (match.sourceVersionId ?? '').trim()
      disposition = heldVersion && heldVersion === sourceVersionId ? 'current' : 'updated'
    }

    bump(counts, disposition)
    items.push({
      sourceFormId,
      sourceVersionId,
      name,
      formNumber,
      pageCount,
      versionLabel,
      disposition,
      heldFormVersionId: match?.id ?? null,
    })
  }

  for (const h of held) {
    if (taken.has(h.id)) continue
    const sourceFormId = (h.sourceFormId ?? '').trim()
    if (!sourceFormId) continue
    if (seenFormIds.has(sourceFormId)) continue
    seenFormIds.add(sourceFormId)
    bump(counts, 'retired')
    items.push({
      sourceFormId,
      sourceVersionId: (h.sourceVersionId ?? '').trim() || 'unknown',
      name: h.name,
      formNumber: normalizeFormNumber(h.formNumber),
      pageCount: null,
      versionLabel: null,
      disposition: 'retired',
      heldFormVersionId: h.id,
    })
  }

  return { items, counts }
}

export type LibrarySnapshot = {
  libraryCode: string
  sourceLibraryId?: string | null
  libraryName?: string | null
  forms: CatalogFormInput[]
}

export type ParsedCatalogPayload = {
  libraries: LibrarySnapshot[]
}

function asForms(value: unknown): CatalogFormInput[] | null {
  if (!Array.isArray(value)) return null
  if (value.length > MAX_FORMS_PER_LIBRARY) return null
  const forms: CatalogFormInput[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    const sourceFormId = String(r.sourceFormId ?? '').trim()
    const sourceVersionId = String(r.sourceVersionId ?? '').trim()
    const name = String(r.name ?? '').trim()
    if (!sourceFormId || !sourceVersionId || !name) return null
    forms.push({
      sourceFormId,
      sourceVersionId,
      name,
      formNumber: r.formNumber == null ? null : String(r.formNumber),
      pageCount: typeof r.pageCount === 'number' ? r.pageCount : null,
      versionLabel: r.versionLabel == null ? null : String(r.versionLabel),
    })
  }
  return forms
}

export function parseCatalogPayload(raw: unknown): ParsedCatalogPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Catalog must be a JSON object.' }
  const obj = raw as Record<string, unknown>

  if (Array.isArray(obj.libraries)) {
    const libraries: LibrarySnapshot[] = []
    for (const lib of obj.libraries) {
      if (!lib || typeof lib !== 'object') return { error: 'Each library entry must be an object.' }
      const row = lib as Record<string, unknown>
      const libraryCode = String(row.libraryCode ?? '').trim().toUpperCase()
      if (!libraryCode) return { error: 'Each library needs a libraryCode (OREF, ODS, or OR).' }
      const forms = asForms(row.forms)
      if (!forms) {
        return {
          error: `Library ${libraryCode} is missing a forms array, or it is larger than ${MAX_FORMS_PER_LIBRARY}.`,
        }
      }
      if (forms.length === 0) {
        return {
          error: `Library ${libraryCode} has no published forms. An empty list is refused so we do not mark the whole library retired.`,
        }
      }
      libraries.push({
        libraryCode,
        sourceLibraryId: row.sourceLibraryId == null ? null : String(row.sourceLibraryId),
        libraryName: row.libraryName == null ? null : String(row.libraryName),
        forms,
      })
    }
    if (!libraries.length) return { error: 'Catalog has no libraries.' }
    return { libraries }
  }

  const libraryCode = String(obj.libraryCode ?? '').trim().toUpperCase()
  if (!libraryCode) return { error: 'Catalog needs libraryCode or a libraries array.' }
  const forms = asForms(obj.forms)
  if (!forms) {
    return { error: `Library ${libraryCode} is missing a forms array, or it is larger than ${MAX_FORMS_PER_LIBRARY}.` }
  }
  if (forms.length === 0) {
    return {
      error: `Library ${libraryCode} has no published forms. An empty list is refused so we do not mark the whole library retired.`,
    }
  }
  return {
    libraries: [
      {
        libraryCode,
        sourceLibraryId: obj.sourceLibraryId == null ? null : String(obj.sourceLibraryId),
        libraryName: obj.libraryName == null ? null : String(obj.libraryName),
        forms,
      },
    ],
  }
}
