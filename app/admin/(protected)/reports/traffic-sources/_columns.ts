// Static presentation config extracted from ./page.tsx (ci:file-size-budget).
// Pure declarative data — no data reads, no formatting, no closures over row
// state. See page.tsx for how each of these is used.
import type { ReportColumn } from '@/components/admin/v2'

/** Row caps the old tables applied. Carried over unchanged. */
export const CAP_TABLE = 10
export const CAP_UNTAGGED = 12

export const utmColumns: ReportColumn[] = [
  { key: 'source', label: 'Source' },
  { key: 'medium', label: 'Medium' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'sessions', label: 'Sessions', numeric: true },
]

export const referrerColumns: ReportColumn[] = [
  { key: 'platform', label: 'Platform' },
  { key: 'referrer', label: 'Referrer' },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'share', label: 'Share', numeric: true },
]

export const ga4SourceMediumColumns: ReportColumn[] = [
  { key: 'source', label: 'Source / Medium' },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'users', label: 'Users', numeric: true },
  { key: 'engaged', label: 'Engaged', numeric: true },
  { key: 'rate', label: 'Engagement', numeric: true },
]

export const landingColumns: ReportColumn[] = [
  { key: 'lp', label: 'Landing page' },
  { key: 'sessions', label: 'Sessions', numeric: true },
]

export const untaggedColumns: ReportColumn[] = [
  { key: 'platform', label: 'Platform' },
  { key: 'count', label: 'Untagged sessions', numeric: true },
  { key: 'utm', label: 'Suggested UTM string' },
]
