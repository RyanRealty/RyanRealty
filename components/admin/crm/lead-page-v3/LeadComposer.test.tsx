/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ATTACH_MENU_ITEMS } from './attach-menu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/people/6761',
  useSearchParams: () => new URLSearchParams('v=3'),
}))

vi.mock('@/components/admin/crm/use-sms-quiet', () => ({
  useSmsQuiet: () => false,
}))

vi.mock('@/components/admin/crm/SmsComposer', () => ({
  SmsComposer: () => <div>SMS composer</div>,
}))

vi.mock('@/components/admin/crm/EmailComposer', () => ({
  EmailComposer: () => <div>Email composer</div>,
}))

vi.mock('@/components/admin/crm/CmaComposeAttach', () => ({
  CmaComposeAttach: () => null,
}))

vi.mock('@/components/admin/crm/ContactSendCenter', () => ({
  ContactSendCenter: () => null,
}))

vi.mock('@/components/admin/crm/MergeFieldInserter', () => ({
  MergeFieldInserter: () => <button type="button">Fields</button>,
}))

import { LeadComposer } from './LeadComposer'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const base = {
  personId: 6761,
  initialChannel: 'sms' as const,
  canSms: true,
  smsNote: null,
  canEmail: true,
  emailNote: null,
  quietHours: false,
  smsTemplates: [{ key: 'intro', name: 'Introduction' }],
  emailTemplates: [{ key: 'follow', name: 'Follow Up' }],
  tplKey: null,
  smsTplKey: null,
  emailInitialSubject: '',
  emailInitialBody: '',
  smsInitialBody: '',
  signatureHtml: null,
  toLabel: null,
  initialTo: [] as string[],
  recipientOptions: [],
  customFields: [],
  smsRecipients: [],
  sendSms: async () => {},
  sendEmail: async () => {},
}

describe('LeadComposer', () => {
  it('toggles Text and Email without leaving the page', () => {
    act(() => root.render(<LeadComposer {...base} />))
    expect(container.textContent).toContain('SMS composer')
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe('Text')

    const email = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Email')
    expect(email).toBeTruthy()
    act(() => email!.click())
    expect(container.textContent).toContain('Email composer')
    expect(Array.from(container.querySelectorAll('[aria-pressed="true"]')).some((el) => el.textContent === 'Email')).toBe(
      true,
    )
  })

  it('lists every Attach menu item from the send-control map', () => {
    act(() => root.render(<LeadComposer {...base} />))
    const attach = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Attach')
    expect(attach).toBeTruthy()
    act(() => attach!.click())
    const menu = container.querySelector('[role="menu"][aria-label="Attach"]')
    expect(menu).toBeTruthy()
    const labels = Array.from(menu!.querySelectorAll('[role="menuitem"]')).map((el) => el.textContent ?? '')
    for (const item of ATTACH_MENU_ITEMS) {
      expect(labels.some((label) => label.includes(item.label))).toBe(true)
    }
  })
})
