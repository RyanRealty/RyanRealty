/**
 * Shared constants for the CRM Reporting module.
 * Used by both server (page.tsx) and client (KpiStrip, Chart, Table) components.
 */

export const ALL_COL_KEYS = [
  'new_leads',
  'initially_assigned',
  'currently_assigned',
  'calls',
  'emails',
  'texts',
  'notes',
  'tasks_completed',
  'appts_set',
  'appointments',
] as const

export type ColKey = (typeof ALL_COL_KEYS)[number]

export const COL_LABELS: Record<ColKey, string> = {
  new_leads: 'New Leads',
  initially_assigned: 'Initially Assigned Leads',
  currently_assigned: 'Currently Assigned Leads',
  calls: 'Calls',
  emails: 'Emails',
  texts: 'Texts',
  notes: 'Notes',
  tasks_completed: 'Tasks Completed',
  appts_set: 'Appointments Set',
  appointments: 'Appointments',
}

/** Short header labels for the table (multi-line wrapping OK) */
export const COL_TABLE_LABELS: Record<ColKey, string> = {
  new_leads: 'New Leads',
  initially_assigned: 'Initially\nAssigned\nLeads',
  currently_assigned: 'Currently\nAssigned\nLeads',
  calls: 'Calls',
  emails: 'Emails',
  texts: 'Texts',
  notes: 'Notes',
  tasks_completed: 'Tasks\nCompleted',
  appts_set: 'Appts Set',
  appointments: 'Appointments',
}

/** Map from ColKey → AgentActivityRow field */
export const COL_TO_ROW_FIELD: Record<ColKey, string> = {
  new_leads: 'newLeads',
  initially_assigned: 'initiallyAssignedLeads',
  currently_assigned: 'currentlyAssignedLeads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

/** Map from ColKey → AgentActivityTotals / TimeSeriesPoint field */
export const COL_TO_METRIC_FIELD: Record<ColKey, string> = {
  new_leads: 'newLeads',
  initially_assigned: 'initiallyAssignedLeads',
  currently_assigned: 'currentlyAssignedLeads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

/**
 * Lead Sources column set — the 7 metrics shown on the Lead Sources report.
 * Intentionally lives in this shared (non-'use client') module so both the
 * server page.tsx and the 'use client' LeadSourcesKpiStrip can import it
 * without hitting Next.js's 'use client' boundary restriction.
 */
export const LS_COL_KEYS: readonly ColKey[] = [
  'new_leads',
  'calls',
  'emails',
  'texts',
  'notes',
  'tasks_completed',
  'appointments',
] as const

/** Parse the ?cols= URL param into an array of valid ColKey values */
export function parseColsParam(raw: string | undefined): ColKey[] {
  if (!raw) return [...ALL_COL_KEYS]
  const parts = raw.split(',').map((s) => s.trim()) as ColKey[]
  const valid = parts.filter((k) => (ALL_COL_KEYS as readonly string[]).includes(k))
  return valid.length > 0 ? valid : [...ALL_COL_KEYS]
}

/** Metric options for the time-series chart (maps to TimeSeriesPoint keys) */
export type MetricKey =
  | 'newLeads'
  | 'calls'
  | 'emails'
  | 'texts'
  | 'notes'
  | 'tasksCompleted'
  | 'appointmentsSet'
  | 'appointments'

export const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: 'newLeads', label: 'New Leads' },
  { key: 'calls', label: 'Calls' },
  { key: 'emails', label: 'Emails' },
  { key: 'texts', label: 'Texts' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasksCompleted', label: 'Tasks Completed' },
  { key: 'appointmentsSet', label: 'Appointments Set' },
  { key: 'appointments', label: 'Appointments' },
]

export const METRIC_LABELS: Record<MetricKey, string> = Object.fromEntries(
  METRIC_OPTIONS.map(({ key, label }) => [key, label]),
) as Record<MetricKey, string>
