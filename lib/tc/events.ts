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
  envelope_sent_to_other_side: 'Signed PDF sent to other side',
  envelope_completed_from_return: 'Other side returned signed PDF',
  document_needs_our_signatures: 'Needs our signatures',
  document_fully_executed: 'Fully executed',
  envelope_reminder_sent: 'Signing reminder sent',
  envelope_voided: 'Envelope voided',
  envelope_seal_blocked: 'Envelope not complete',
  cycle_imported_from_skyslope: 'Imported from SkySlope',
  oref_filled: 'OREF filled',
  person_added: 'Person added',
  deal_stage_changed: 'Stage changed',
  deal_assigned: 'Deal assigned',
  listing_contract_accepted: 'Contract accepted',
  listing_duplicated: 'Listing duplicated',
  listing_merged: 'Listing merged in',
  listing_merged_away: 'Merged into another file',
  offer_received: 'Offer received',
  offer_updated: 'Offer updated',
  offer_accepted: 'Offer accepted',
  cda_generated: 'CDA generated',
  buyer_agreement_drafted: 'Buyer agreement drafted',
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
