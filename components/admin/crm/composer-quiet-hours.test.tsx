/**
 * @vitest-environment jsdom
 *
 * Matt 2026-10-04, two calls on texting in quiet hours:
 *   "Both zones": quiet hours run in Pacific AND the recipient number's own
 *     zone, so the composer reads each number's zones live, not just Pacific.
 *   "1:1 only": a text typed on a phone to ONE person still sends at any hour;
 *     a phone GROUP text in quiet hours waits until 8am, or a computer's
 *     "send anyway".
 * The server enforces both on every send (lib/comms/guards.ts); these pin what
 * the broker sees and what the form posts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({ mobile: true }))

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => h.mobile }))
vi.mock('@/app/actions/crm-templates', () => ({ createTemplateAction: vi.fn() }))
vi.mock('@/app/admin/(protected)/messages/actions', () => ({
  attachLibraryItemAction: vi.fn(),
  saveComposeDraftAction: vi.fn(),
  searchComposePeopleAction: vi.fn(async () => []),
  sendComposeAction: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/crm/TextDraftTools', () => ({ TextDraftTools: () => null }))

import { SmsComposer, type SmsRecipient } from './SmsComposer'
import { ComposeSurface } from './ComposeSurface'
import { PHONE_GROUP_QUIET_NOTE } from '@/lib/crm/compose-group'

const PACIFIC = ['America/Los_Angeles']
const NEW_YORK = ['America/New_York']
const QUIET_NIGHT = new Date('2026-06-25T04:00:00Z') // 9:00pm PDT: Pacific is quiet
const NY_EVENING = new Date('2026-06-25T00:30:00Z') // 5:30pm PDT, 8:30pm EDT
const MIDDAY = new Date('2026-06-24T19:00:00Z') // noon PDT, 3pm EDT

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function render(node: React.ReactElement, at: Date) {
  vi.setSystemTime(at)
  act(() => root.render(node))
}

const lead = (overrides: Partial<SmsRecipient> = {}): SmsRecipient => ({
  personId: 42,
  name: 'Jane',
  phone: '+15415551111',
  relation: 'Primary',
  timeZones: PACIFIC,
  ...overrides,
})

function smsComposer(recipients: SmsRecipient[], primaryTimeZones = PACIFIC, quietHours = false) {
  return (
    <SmsComposer
      initialBody="Running late, see you at 6"
      sendAction={vi.fn(async () => {})}
      recipients={recipients}
      primaryPersonId={42}
      personId={42}
      hideQuietHours
      quietHours={quietHours}
      primaryTimeZones={primaryTimeZones}
    />
  )
}

const overrideInput = () => container.querySelector('input[name="overrideQuietHours"]') as HTMLInputElement | null
const sendButton = () => container.querySelector('button[aria-label="Send text"]') as HTMLButtonElement

describe('SmsComposer on a phone', () => {
  it('a one-person text in quiet hours still goes: the override rides along', () => {
    render(smsComposer([lead()], PACIFIC, true), QUIET_NIGHT)
    expect(overrideInput()?.value).toBe('1')
    expect(sendButton().disabled).toBe(false)
    expect(container.textContent).not.toContain(PHONE_GROUP_QUIET_NOTE)
  })

  it('a group text in quiet hours waits: no override, a note, Send disabled', () => {
    const spouse = lead({ personId: 43, name: 'Sam', phone: '+15415552222', relation: 'Spouse', defaultOn: true })
    render(smsComposer([lead(), spouse], PACIFIC, true), QUIET_NIGHT)
    expect(overrideInput()).toBeNull()
    expect(container.textContent).toContain(PHONE_GROUP_QUIET_NOTE)
    expect(sendButton().disabled).toBe(true)
  })

  it('a group text inside every zone sends as usual', () => {
    const spouse = lead({ personId: 43, name: 'Sam', phone: '+15415552222', relation: 'Spouse', defaultOn: true })
    render(smsComposer([lead(), spouse]), MIDDAY)
    expect(container.textContent).not.toContain(PHONE_GROUP_QUIET_NOTE)
    expect(sendButton().disabled).toBe(false)
  })

  it('holds a group by the New York member’s clock, live, though the server said open', () => {
    const nyCousin = lead({ personId: 44, name: 'Al', phone: '+12125550100', relation: 'Cousin', defaultOn: true, timeZones: NEW_YORK })
    render(smsComposer([lead(), nyCousin], PACIFIC, false), NY_EVENING)
    expect(container.textContent).toContain(PHONE_GROUP_QUIET_NOTE)
    expect(sendButton().disabled).toBe(true)
  })
})

const person = (id: number, timeZones: string[], phone = '+15415551111') => ({
  id,
  name: `Person ${id}`,
  phone,
  email: null,
  timeZones,
})

function compose(people: ReturnType<typeof person>[], quiet: boolean) {
  return <ComposeSurface initialPeople={people} initialChannel="text" quiet={quiet} draftText="hello" />
}

const composeSend = () =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === 'Send') as HTMLButtonElement

describe('ComposeSurface', () => {
  it('phone, one person, quiet hours: Send stays live', () => {
    h.mobile = true
    render(compose([person(42, PACIFIC)], true), QUIET_NIGHT)
    expect(composeSend().disabled).toBe(false)
    expect(container.textContent).not.toContain(PHONE_GROUP_QUIET_NOTE)
  })

  it('phone, two people, quiet hours: the group waits with a note', () => {
    h.mobile = true
    render(compose([person(42, PACIFIC), person(43, PACIFIC, '+15415552222')], true), QUIET_NIGHT)
    expect(composeSend().disabled).toBe(true)
    expect(container.textContent).toContain(PHONE_GROUP_QUIET_NOTE)
  })

  it('computer, one New York number at 5:30pm Pacific: Send anyway appears and gates Send', () => {
    h.mobile = false
    render(compose([person(44, NEW_YORK, '+12125550100')], false), NY_EVENING)
    expect(container.textContent).toContain('Send anyway. Quiet hours.')
    expect(composeSend().disabled).toBe(true)
  })

  it('computer, the same number at noon Pacific: no quiet-hours control', () => {
    h.mobile = false
    render(compose([person(44, NEW_YORK, '+12125550100')], false), MIDDAY)
    expect(container.textContent).not.toContain('Send anyway')
    expect(composeSend().disabled).toBe(false)
  })
})
