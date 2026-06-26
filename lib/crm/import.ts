/**
 * lib/crm/import.ts — pure helpers for the CSV import wizard.
 *
 * All functions here are side-effect free (no DB, no network, no env reads) so
 * they can be exhaustively unit-tested. The API route /api/admin/crm-import
 * handles the actual upsert.
 *
 * Supported field map targets (subset of crm_people columns importable via CSV):
 */

export const IMPORTABLE_FIELDS = [
  { key: 'first_name',  label: 'First name' },
  { key: 'last_name',   label: 'Last name' },
  { key: 'email',       label: 'Email' },
  { key: 'phone',       label: 'Phone' },
  { key: 'stage',       label: 'Stage' },
  { key: 'tags',        label: 'Tags (comma-separated)' },
  { key: 'source',      label: 'Source' },
  { key: 'address',     label: 'Address' },
  { key: '__skip__',    label: '— skip this column —' },
] as const

export type ImportableFieldKey = typeof IMPORTABLE_FIELDS[number]['key']

/** A row produced by the CSV parser — headers as keys, values as strings. */
export type CsvRow = Record<string, string>

/** One fully-validated contact ready for upsert. */
export type ImportContact = {
  first_name: string
  last_name: string
  /** Primary email — stored in crm_contact_points (kind='email') and mirrored into crm_people.emails jsonb. */
  email: string | null
  /** Primary phone — stored in crm_contact_points (kind='phone') and mirrored into crm_people.phones jsonb. */
  phone: string | null
  stage: string | null
  tags: string[]
  source: string | null
  address: string | null
  name: string          // derived: first_name + ' ' + last_name
}

/** Field mapping: CSV header → IMPORTABLE_FIELDS key. */
export type FieldMapping = Record<string, ImportableFieldKey>

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into headers + rows.
 * Handles quoted fields (including embedded commas and newlines).
 * Returns { headers, rows } where rows is an array of header→value maps.
 */
export function parseCsv(raw: string): { headers: string[]; rows: CsvRow[] } {
  const lines = splitCsvLines(raw.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0])
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.every((v) => v === '')) continue // skip blank rows
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

/** Split CSV text into logical lines (handles quoted newlines). */
function splitCsvLines(text: string): string[] {
  const lines: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuote = !inQuote
      cur += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      lines.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/** Parse a single CSV line into field values, handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

// ─── Auto-mapping ─────────────────────────────────────────────────────────────

/** Attempt to auto-suggest a field mapping from CSV headers using fuzzy matches. */
export function autoDetectMapping(headers: string[]): FieldMapping {
  const ALIASES: Record<string, ImportableFieldKey> = {
    // first_name
    'first name': 'first_name', firstname: 'first_name', 'first': 'first_name',
    // last_name
    'last name': 'last_name', lastname: 'last_name', 'last': 'last_name', surname: 'last_name',
    // email
    email: 'email', 'email address': 'email', 'e-mail': 'email',
    // phone
    phone: 'phone', 'phone number': 'phone', mobile: 'phone', cell: 'phone', telephone: 'phone',
    // stage
    stage: 'stage', status: 'stage', 'lead stage': 'stage',
    // tags
    tags: 'tags', tag: 'tags', labels: 'tags',
    // source
    source: 'source', 'lead source': 'source', origin: 'source',
    // address
    address: 'address', 'home address': 'address', 'street address': 'address',
  }

  const mapping: FieldMapping = {}
  for (const h of headers) {
    const norm = h.trim().toLowerCase()
    mapping[h] = ALIASES[norm] ?? '__skip__'
  }
  return mapping
}

// ─── Row-to-contact mapping ───────────────────────────────────────────────────

/** Apply a FieldMapping to a single CSV row and produce an ImportContact. */
export function mapRowToContact(row: CsvRow, mapping: FieldMapping): ImportContact {
  // Build a field→value map by inverting the mapping (last writer wins on collision)
  const fields: Partial<Record<ImportableFieldKey, string>> = {}
  for (const [header, fieldKey] of Object.entries(mapping)) {
    if (fieldKey === '__skip__') continue
    const val = (row[header] ?? '').trim()
    if (val) fields[fieldKey] = val
  }

  const first = (fields.first_name ?? '').trim()
  const last  = (fields.last_name  ?? '').trim()
  const tags  = (fields.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  return {
    first_name: first,
    last_name:  last,
    name:       [first, last].filter(Boolean).join(' '),
    email:      fields.email   ?? null,
    phone:      fields.phone   ?? null,
    stage:      fields.stage   ?? null,
    source:     fields.source  ?? null,
    address:    fields.address ?? null,
    tags,
  }
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export type DupWarning = {
  rowIndex: number
  email: string
  /** 'csv' = duplicate within the uploaded file; 'db' = email already in crm_people. */
  type: 'csv' | 'db'
}

/**
 * Find intra-CSV duplicates (same email appearing more than once in the file).
 * DB-level duplicates are detected by the upsert route and returned in error_rows.
 */
export function findCsvDuplicates(contacts: ImportContact[]): DupWarning[] {
  const seen = new Map<string, number>()
  const warnings: DupWarning[] = []
  contacts.forEach((c, i) => {
    if (!c.email) return
    const e = c.email.toLowerCase()
    if (seen.has(e)) {
      warnings.push({ rowIndex: i + 1, email: c.email, type: 'csv' })
    } else {
      seen.set(e, i)
    }
  })
  return warnings
}
