import { describe, expect, it } from 'vitest'
import { ATTACH_MENU_ITEMS, leadComposerSubmitLabel } from './attach-menu'

describe('Attach menu', () => {
  it('holds every deliverable the send popover used to', () => {
    expect(ATTACH_MENU_ITEMS.map((i) => i.id)).toEqual([
      'file',
      'cma',
      'bpo',
      'listings',
      'report',
      'newsletter',
      'link',
    ])
    expect(ATTACH_MENU_ITEMS.find((i) => i.id === 'cma')?.hint).toBe('build or pick')
    expect(ATTACH_MENU_ITEMS.find((i) => i.id === 'listings')?.hint).toBe('+ start alerts')
  })

  it('changes the primary send label with the Text/Email toggle', () => {
    expect(leadComposerSubmitLabel('sms')).toBe('Send text')
    expect(leadComposerSubmitLabel('email')).toBe('Send email')
  })
})
