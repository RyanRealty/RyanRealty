import { describe, expect, it } from 'vitest'
import { tcEventLabel, tcEventDetailPreview } from './events'

describe('tcEventLabel', () => {
  it('names auto-file actions in plain language', () => {
    expect(tcEventLabel('mail_filed')).toBe('Mail filed')
    expect(tcEventLabel('sms_filed')).toBe('Text filed')
  })
  it('falls back to spaced keys', () => {
    expect(tcEventLabel('checklist_item_completed')).toBe('checklist item completed')
  })
})

describe('tcEventDetailPreview', () => {
  it('prefers a mail subject over the JSON dump', () => {
    expect(tcEventDetailPreview({ title: 'Prelim title for 20702 Beaumont', dedupe: 'x' })).toBe(
      'Prelim title for 20702 Beaumont',
    )
  })
  it('returns null on empty', () => {
    expect(tcEventDetailPreview({})).toBeNull()
    expect(tcEventDetailPreview(null)).toBeNull()
  })
})
