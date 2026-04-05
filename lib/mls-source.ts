export type MlsSourceMeta = {
  key: string
  label: string
  logoPath: string | null
}

const SOURCE_MAP: Record<string, MlsSourceMeta> = {
  central_oregon: {
    key: 'central_oregon',
    label: 'Oregon Data Share',
    logoPath: '/images/oregon-data-share-logo.svg',
  },
  oregon_data_share: {
    key: 'oregon_data_share',
    label: 'Oregon Data Share',
    logoPath: '/images/oregon-data-share-logo.svg',
  },
  morgan_data_shuttle: {
    key: 'morgan_data_shuttle',
    label: 'Morgan Data Shuttle',
    logoPath: '/images/morgan-data-shuttle-logo.svg',
  },
}

function toNormalizedKey(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function titleCaseWords(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getMlsSourceMeta(source: string | null | undefined): MlsSourceMeta {
  const key = toNormalizedKey(source)
  if (SOURCE_MAP[key]) return SOURCE_MAP[key]!
  if (!key) return SOURCE_MAP.central_oregon
  return {
    key,
    label: titleCaseWords(key),
    logoPath: null,
  }
}

export function normalizeMlsDisplayNumber(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  // User-facing MLS numbers should be the short list number, not long internal IDs.
  // Accept 5-12 chars (numeric primary, with optional letter prefixes for other MLSs).
  if (!/^[a-zA-Z0-9]{5,12}$/.test(raw)) return null
  return raw
}
