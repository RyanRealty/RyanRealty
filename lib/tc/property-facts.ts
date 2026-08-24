import { EMPTY_PROPERTY_FACTS, type PropertyFacts } from './required-documents'

const KEYS = Object.keys(EMPTY_PROPERTY_FACTS) as (keyof PropertyFacts)[]

/** Later layers win, including confirmed false. Undefined leaves the previous value. */
export function overlayPropertyFacts(
  base: PropertyFacts,
  overlay: Partial<PropertyFacts> | null | undefined,
): PropertyFacts {
  if (!overlay) return { ...base }
  const out: PropertyFacts = { ...base }
  for (const key of KEYS) {
    if (Object.prototype.hasOwnProperty.call(overlay, key) && overlay[key] !== undefined) {
      Object.assign(out, { [key]: overlay[key] })
    }
  }
  return out
}

export function parseSavedPropertyFacts(raw: unknown): Partial<PropertyFacts> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Partial<PropertyFacts> = {}
  const boolKeys: (keyof PropertyFacts)[] = [
    'hasWell',
    'hasSeptic',
    'hasHOA',
    'isCondo',
    'isManufactured',
    'isVacantLand',
    'hasSolar',
    'isTenantOccupied',
    'isShortSale',
    'isSellerCarried',
    'hasTeam',
  ]
  for (const key of boolKeys) {
    if (o[key] === true || o[key] === false) Object.assign(out, { [key]: o[key] })
  }
  if (o.yearBuilt != null) {
    const n = Number(o.yearBuilt)
    if (Number.isFinite(n) && n > 1800 && n < 2100) out.yearBuilt = n
  }
  if (o.financing === 'va' || o.financing === 'fha' || o.financing === 'conventional' || o.financing === 'cash') {
    out.financing = o.financing
  }
  return Object.keys(out).length ? out : null
}

export function referralFeeDollars(gci: number | null | undefined, feePct: number | null | undefined): number | null {
  if (gci == null || !Number.isFinite(gci) || gci <= 0) return null
  if (feePct == null || !Number.isFinite(feePct) || feePct <= 0 || feePct > 100) return null
  return Math.round(gci * (feePct / 100) * 100) / 100
}

export function parseInboundFeePct(custom: unknown): number | null {
  if (!custom || typeof custom !== 'object') return null
  const n = Number((custom as { inboundFeePct?: unknown }).inboundFeePct)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}

/** Do not overwrite a fee already recorded on the commission row. */
export function prefillReferralFee(
  existingFee: number,
  gci: number | null | undefined,
  feePct: number | null | undefined,
): number | null {
  if (existingFee > 0) return null
  return referralFeeDollars(gci, feePct)
}
