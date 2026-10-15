/**
 * Locked defaults for the admin queue screens (Matt 2026-10-14 audit).
 *
 * Bare URLs must land on the work, not the firehose: prospecting ready-to-send,
 * messages Needs attention, listings Active. Chrome must not cover the last
 * row on a phone, and the global + FAB stays off Valuations.
 */

export const PROSPECTING_DEFAULT_STATUS = 'sendable' as const
export const MESSAGES_DEFAULT_FOLDER = 'inbox' as const
export const LISTINGS_DEFAULT_STATUS = 'Active' as const
export const EMAIL_CAMPAIGNS_REDIRECT = '/admin/audiences' as const
export const CMA_NAV_HREF = '/admin/valuations' as const
/** Mobile main padding under the tab bar. The + FAB lives in the header on phones. */
export const ADMIN_MOBILE_MAIN_PADDING = 'pb-36' as const
/** Header slot the mobile + FAB portals into so it cannot cover row actions. */
export const ADMIN_FAB_HEADER_SLOT_ID = 'admin-console-header-actions'
export const CMA_QUEUE_PAGE_READ_LIMIT = 200

export const PROSPECTING_STATUSES = [
  'sendable',
  'needs-audit',
  'no-phone',
  'sent',
  'excluded',
  'all',
] as const

export type ProspectingStatusDefault = (typeof PROSPECTING_STATUSES)[number]

export const MESSAGES_FOLDERS = [
  'inbox',
  'assigned',
  'drafts',
  'sent',
  'closed',
  'recent',
] as const

export type MessagesFolderDefault = (typeof MESSAGES_FOLDERS)[number]

export const LISTINGS_STATUSES = ['Active', 'Pending', 'Closed', 'all'] as const
export type ListingsStatusDefault = (typeof LISTINGS_STATUSES)[number]

function one(raw: string | string[] | null | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim()
  return String(raw ?? '').trim()
}

export function resolveProspectingStatus(
  raw: string | string[] | null | undefined,
): ProspectingStatusDefault {
  const value = one(raw)
  return (PROSPECTING_STATUSES as readonly string[]).includes(value)
    ? (value as ProspectingStatusDefault)
    : PROSPECTING_DEFAULT_STATUS
}

export function resolveMessagesFolder(
  raw: string | string[] | null | undefined,
): MessagesFolderDefault {
  const value = one(raw)
  return (MESSAGES_FOLDERS as readonly string[]).includes(value)
    ? (value as MessagesFolderDefault)
    : MESSAGES_DEFAULT_FOLDER
}

export function resolveListingsStatus(
  raw: string | string[] | null | undefined,
): ListingsStatusDefault {
  const value = one(raw)
  return (LISTINGS_STATUSES as readonly string[]).includes(value)
    ? (value as ListingsStatusDefault)
    : LISTINGS_DEFAULT_STATUS
}

/** Hide the global + FAB on surfaces that own the bottom edge or their own create. */
export function isConsoleFabSuppressed(pathname: string): boolean {
  const path = pathname.trim()
  return (
    path.startsWith('/admin/crm/inbox') ||
    path.startsWith('/admin/messages') ||
    path.startsWith('/admin/valuations')
  )
}

export function listingsDalStatus(
  status: ListingsStatusDefault,
): string | undefined {
  return status === 'all' ? undefined : status
}
