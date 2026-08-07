// Static presentation config extracted from ./page.tsx (ci:file-size-budget).
// Pure declarative data — no data reads, no formatting, no closures over row
// state. Every label below is carried character for character from the page's
// pre-11D markup. See page.tsx for how each is used.
import type { AdminState, ReportColumn } from '@/components/admin/v2'

/** Agency role on the anticipated-documents predictor. */
export const ROLE_LABEL: Record<string, string> = {
  listing: 'Listing side',
  buyer: 'Buyer side',
  dual: 'Disclosed dual agency',
  unknown: 'Role not set',
}

/** Which side of the transaction a commission row pays. */
export const SIDE_LABEL: Record<string, string> = {
  listing: 'Listing side',
  buyer: 'Buyer side',
  both: 'Both sides',
  unknown: 'Side not set',
}

/**
 * Commission status. The words are unchanged; the shadcn Badge colors became v2
 * state words (status is text + color, never color alone — WCAG 1.4.1).
 * projected → slow (was warning), settlement_verified → ok (was success),
 * paid → accent (was the primary solid).
 */
export const COMMISSION_STATUS: Record<string, { label: string; state: AdminState }> = {
  projected: { label: 'Projected', state: 'slow' },
  settlement_verified: { label: 'Settlement verified', state: 'ok' },
  paid: { label: 'Paid', state: 'accent' },
}

/** Deal stage words, carried from the page's stageLabel map. */
export const STAGE_LABEL: Record<string, string> = {
  pending: 'Under contract',
  active_listing: 'Active listing',
  pre_contract: 'Pre-contract',
  closed: 'Closed',
  dead: 'Canceled',
}

/** The six columns the document table has always shown, in the same order. */
export const DOC_COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'pages', label: 'Pages', numeric: true },
  { key: 'size', label: 'Size', numeric: true },
  { key: 'uploaded', label: 'Uploaded', numeric: true },
  { key: 'state', label: 'State' },
  { key: 'actions', label: 'Actions' },
]

export const DOC_TEMPLATE =
  'minmax(240px, 2.6fr) minmax(56px, 0.4fr) minmax(72px, 0.5fr) minmax(96px, 0.7fr) minmax(120px, 0.9fr) minmax(150px, 1fr)'
export const DOC_MIN_WIDTH = 900
