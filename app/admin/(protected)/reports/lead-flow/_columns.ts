// Static presentation config extracted from ./page.tsx (ci:file-size-budget).
// Pure declarative data — no data reads, no formatting, no closures over row
// state. See page.tsx for how each of these is used.
import type { ReportColumn } from '@/components/admin/v2'

/** Row caps the old tables applied. Carried over unchanged. */
export const CAP_SOURCES = 10
export const CAP_WIRING = 12
export const CAP_SPLIT = 10
export const CAP_EVENTS = 10
export const CAP_DAYS = 14

export const funnelColumns: ReportColumn[] = [
  { key: 'stage', label: 'Stage' },
  { key: 'source', label: 'Source' },
  { key: 'count', label: 'Count', numeric: true },
  { key: 'pct', label: 'vs sessions', numeric: true },
]

export const wiringColumns: ReportColumn[] = [
  { key: 'surface', label: 'Surface' },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'events', label: 'GA4 events', numeric: true },
  { key: 'assignments', label: 'CRM leads', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
]

export const splitColumns = (first: string): ReportColumn[] => [
  { key: 'name', label: first },
  { key: 'count', label: 'Count', numeric: true },
  { key: 'share', label: 'Share', numeric: true },
]

export const topLeadSourcesColumns: ReportColumn[] = [
  { key: 'src', label: 'Source / Medium' },
  { key: 'events', label: 'Lead events', numeric: true },
  { key: 'users', label: 'Users', numeric: true },
]

export const topLeadEventColumns: ReportColumn[] = [
  { key: 'name', label: 'Event name' },
  { key: 'count', label: 'Count', numeric: true },
  { key: 'users', label: 'Users', numeric: true },
]
