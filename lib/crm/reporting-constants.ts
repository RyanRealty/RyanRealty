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

// ── Reporting Hub card data ────────────────────────────────────────────────────
//
// Shared between the Overview hub (reporting/page.tsx) and the Overview report
// (reporting/overview/page.tsx).  Lives here — a non-'use client' module — so
// both server pages and 'use client' components can import without hitting the
// Next.js server-boundary restriction.
//
// NOTE: reporting/page.tsx keeps its own local copies of these arrays (no change
// needed there).  These exports are for overview/page.tsx and any future consumer.

export type ReportHubCard = {
  icon: string
  title: string
  description: string
  href: string
}

export const HUB_AGENT_REPORTS: ReportHubCard[] = [
  {
    icon: '📊',
    title: 'Agent Activity',
    description: 'See the number of leads per agent alongside stats on follow up.',
    href: '/admin/crm/reporting/agent-activity',
  },
  {
    icon: '📞',
    title: 'Calls',
    description: 'See calls made, conversations, missed calls, talk time and more by agent.',
    href: '/admin/crm/reporting/calls',
  },
  {
    icon: '📋',
    title: 'Call Logs',
    description: 'See and listen to recent inbound and outbound calls.',
    href: '/admin/crm/reporting/call-logs',
  },
  {
    icon: '💬',
    title: 'Texts',
    description: 'See text message delivery rates and other stats by phone number.',
    href: '/admin/crm/reporting/texts',
  },
  {
    icon: '📅',
    title: 'Appointments',
    description: 'See a list of appointments & outcomes with details on lead source and agent.',
    href: '/admin/crm/reporting/appointments',
  },
  {
    icon: '💰',
    title: 'Deals',
    description: 'See a list of deals with commissions by deal stage and lead source.',
    href: '/admin/crm/reporting/deals',
  },
  {
    icon: '📝',
    title: 'Agent Goals',
    description: 'Manage annual commission and personal goals for each agent.',
    href: '/admin/crm/reporting/agent-goals',
  },
]

export const HUB_LEAD_SOURCE_REPORTS: ReportHubCard[] = [
  {
    icon: '📈',
    title: 'Source Report',
    description: 'See your top lead providers and sources of appointments.',
    href: '/admin/crm/reporting/lead-sources',
  },
  {
    icon: '🚀',
    title: 'Speed To Lead',
    description: 'See how quickly you follow up by source and follow up type.',
    href: '/admin/crm/reporting/speed-to-lead',
  },
  {
    icon: '📱',
    title: 'Contact Attempts',
    description: 'See how many times you follow up on average by source.',
    href: '/admin/crm/reporting/contact-attempts',
  },
  {
    icon: '🤓',
    title: 'Closed Deals By Source',
    description: 'See which lead source has the most closed deals, commission and conversion rate %.',
    href: '/admin/crm/reporting/lead-sources',
  },
]

export const HUB_MARKETING_REPORTS: ReportHubCard[] = [
  {
    icon: '💌',
    title: 'Batch Emails',
    description: 'See the results of your email campaigns, opens & clicks.',
    href: '/admin/crm/reporting/batch-emails',
  },
  {
    icon: '🏠',
    title: 'Properties',
    description: 'See which properties and zipcodes have the most inquiries.',
    href: '/admin/crm/reporting/properties',
  },
  {
    icon: '🔍',
    title: 'Marketing UTM Report',
    description: 'See advanced UTM and campaign metrics and appointments & deals.',
    href: '/admin/crm/reporting/marketing',
  },
]
