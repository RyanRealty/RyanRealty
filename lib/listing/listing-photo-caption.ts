/**
 * Lot gallery captions. A plan rendering is a plan, not listed condition.
 */

const PLAN_SHAPE =
  /\b(plan|rendering|render|floor\s*plan|site\s*plan|house\s*plan|elevation)\b/i

export function isPlanRenderingCaption(caption: string | null | undefined): boolean {
  const raw = caption?.trim() ?? ''
  if (!raw) return false
  return PLAN_SHAPE.test(raw)
}

function sentenceCase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function publishListingPhotoCaption(caption: string | null | undefined): string | null {
  const raw = caption?.trim()
  if (!raw) return null
  if (!isPlanRenderingCaption(raw)) return raw

  const withoutLead = raw.replace(/^(rendering of|render of|a rendering of)\s+/i, '')
  const remainder = sentenceCase(withoutLead)
  const labeled = /^plan\b/i.test(remainder) ? remainder : `Plan. ${remainder}`
  if (/not listed condition/i.test(labeled)) return labeled
  return `${labeled.replace(/\.$/, '')}. Not listed condition.`
}
