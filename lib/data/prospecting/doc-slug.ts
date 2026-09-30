/**
 * The base (unversioned) CMA slug a prospect's email intro sends from.
 *
 * sendProspectingEmailIntro resolves the client-ready document from this base
 * (base, then base--v2, base--v3, ...), and the rail keys the send's
 * email_events rows `cma:<that slug>`. The stuck-send recovery looks for those
 * rows by the same base, so both sides take it from this one rule and cannot
 * drift apart.
 */
import { cmaSlugBase, slugifyAddress } from '@/lib/cma/address-slug'
import type { ProspectRow } from './types'

export function prospectDocBaseSlug(prospect: Pick<ProspectRow, 'doc' | 'streetAddress'>): string | null {
  if (prospect.doc.state === 'ready' || prospect.doc.state === 'sent') return cmaSlugBase(prospect.doc.slug)
  return prospect.streetAddress ? slugifyAddress(prospect.streetAddress) : null
}

/** True when `emailKey` is the rail's key for this base or one of its --vN versions. */
export function isCmaEmailKeyForBase(emailKey: string | null | undefined, baseSlug: string | null | undefined): boolean {
  if (!emailKey || !baseSlug) return false
  const prefix = `cma:${baseSlug}`
  if (emailKey === prefix) return true
  return emailKey.startsWith(`${prefix}--v`) && /^\d+$/.test(emailKey.slice(prefix.length + 3))
}
