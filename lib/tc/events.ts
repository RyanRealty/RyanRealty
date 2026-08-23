/**
 * Human labels for tc_events.action on the deal activity list.
 * Auto-file (mail_filed / sms_filed) must read as a deal log line, not a raw key.
 */
export const TC_EVENT_LABEL: Record<string, string> = {
  mail_filed: 'Mail filed',
  sms_filed: 'Text filed',
  envelope_drafted: 'Envelope drafted',
  envelope_sent: 'Envelope sent',
  envelope_completed: 'Envelope completed',
  envelope_reminder_sent: 'Signing reminder sent',
  envelope_voided: 'Envelope voided',
  cycle_imported_from_skyslope: 'Imported from SkySlope',
  oref_filled: 'OREF filled',
  person_added: 'Person added',
  deal_stage_changed: 'Stage changed',
  contact_added: 'Contact added',
  checklist_status_changed: 'Checklist updated',
  principal_broker_review: 'Principal review',
}

export function tcEventLabel(action: string | null | undefined): string {
  const a = (action ?? '').trim()
  if (!a) return 'Event'
  return TC_EVENT_LABEL[a] ?? a.replace(/_/g, ' ')
}

export function tcEventDetailPreview(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || typeof detail !== 'object') return null
  const title = typeof detail.title === 'string' ? detail.title.trim() : ''
  if (title) return title.slice(0, 120)
  const keys = Object.keys(detail)
  if (!keys.length) return null
  return JSON.stringify(detail).slice(0, 120)
}
