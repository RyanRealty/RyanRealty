/**
 * CMA ↔ person identity. Rebuild used to persist an empty client_name and
 * the review header only read that column — a linked person then showed as
 * "No client on file."
 */

export function resolveCmaClientName(opts: {
  enteredName?: string | null
  storedName?: string | null
  linkedPersonName?: string | null
}): string | null {
  const entered = opts.enteredName?.trim() || null
  const stored = opts.storedName?.trim() || null
  const linked = opts.linkedPersonName?.trim() || null
  return entered || stored || linked
}

export function parsePositiveInt(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function parsePositiveNumber(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
