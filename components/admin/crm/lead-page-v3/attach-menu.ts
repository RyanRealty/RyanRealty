export const ATTACH_MENU_ITEMS = [
  { id: 'file', label: 'File or photo', hint: 'PDF, image' },
  { id: 'cma', label: 'CMA', hint: 'build or pick' },
  { id: 'bpo', label: 'Price opinion (BPO)', hint: null },
  { id: 'listings', label: 'Listing(s)', hint: '+ start alerts' },
  { id: 'report', label: 'Market report', hint: 'by area' },
  { id: 'newsletter', label: 'Newsletter issue', hint: null },
  { id: 'link', label: 'Personal tracking link', hint: null },
] as const

export type AttachMenuItemId = (typeof ATTACH_MENU_ITEMS)[number]['id']

export type LeadComposerChannel = 'sms' | 'email'

export function leadComposerSubmitLabel(channel: LeadComposerChannel): string {
  return channel === 'sms' ? 'Send text' : 'Send email'
}
