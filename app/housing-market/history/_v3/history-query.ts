/**
 * GET contract for /housing-market/history.
 * Keys: year, city, type, fireplace, min, max.
 * Empty / "all" values are omitted so the URL stays the same as the old sheet.
 */

export const HISTORY_PATH = '/housing-market/history'
export const HISTORY_FROM_YEAR = 1998
export const HISTORY_TO_YEAR = 2030

export const HISTORY_QUERY_KEYS = ['year', 'city', 'type', 'fireplace', 'min', 'max'] as const

export type HistoryQueryInput = {
  year: string
  city?: string
  type?: string
  fireplace?: boolean | string
  min?: number | string
  max?: number | string
}

function meaningful(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === 'all') return undefined
  return trimmed
}

function finiteNumber(value: number | string | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

export function buildHistoryQuery(input: HistoryQueryInput): string {
  const params = new URLSearchParams()
  const year = meaningful(input.year)
  if (year) params.set('year', year)
  const city = meaningful(input.city)
  if (city) params.set('city', city)
  const type = meaningful(input.type)
  if (type) params.set('type', type)
  if (input.fireplace === true || input.fireplace === '1' || input.fireplace === 'true') {
    params.set('fireplace', '1')
  }
  const min = finiteNumber(input.min)
  if (min != null) params.set('min', String(min))
  const max = finiteNumber(input.max)
  if (max != null) params.set('max', String(max))
  const qs = params.toString()
  return qs ? `${HISTORY_PATH}?${qs}` : HISTORY_PATH
}

export function historyQueryFromFormData(data: FormData): string {
  return buildHistoryQuery({
    year: String(data.get('year') ?? ''),
    city: String(data.get('city') ?? ''),
    type: String(data.get('type') ?? ''),
    fireplace: String(data.get('fireplace') ?? ''),
    min: String(data.get('min') ?? ''),
    max: String(data.get('max') ?? ''),
  })
}
