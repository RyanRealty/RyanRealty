import { describe, expect, it, beforeEach, vi } from 'vitest'

/**
 * The engagement → broker rail.
 *
 * What is pinned here is what would otherwise go wrong silently: an alert that
 * bypasses the broker's preference switches (the bug broker-notify-prefs was
 * written to close), an alert about a contact we cannot name, an alert on a
 * document nobody sent, and a broker being texted about their own QA send.
 */

const state = {
  person: null as null | { id: number; name: string | null; assignedBroker: string | null; isBrokerMailbox: boolean },
  latestSent: null as null | { id: string; slug: string; subjectAddress: string; sentAt: string; personId: number | null },
  bySlug: null as null | { id: string; slug: string; subjectAddress: string; sentAt: string; personId: number | null },
  recorded: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
}

vi.mock('@/lib/data/cma/engagementAlerts', () => ({
  getAlertPerson: async () => state.person,
  findLatestSentCmaForPerson: async () => state.latestSent,
  findSentCmaBySlug: async () => state.bySlug,
  recordCmaRepliedEvent: async (p: Record<string, unknown>) => {
    state.recorded.push(p)
    return true
  },
}))

vi.mock('@/lib/crm/broker-alerts', () => ({
  BROKER_ALERT_ORIGIN: 'https://ryan-realty.com',
  queueBrokerAlert: async (a: Record<string, unknown>) => {
    state.alerts.push(a)
    return true
  },
}))

const {
  routeCmaReplyToBroker,
  queueCmaOpenedAlert,
  cmaSlugFromDocumentUrl,
  cmaSlugFromEmailKey,
} = await import('./cma-engagement')

// The real mapping the rail depends on — imported, not restated, so a change to
// the prefix vocabulary fails HERE rather than silently ungating an alert.
const { categoryForAlertKind } = await import('./broker-notify-prefs')

const CMA = { id: 'c1', slug: 'cma-828-florida', subjectAddress: '828 Florida, Bend, OR 97703', sentAt: '2026-09-01T10:00:00Z', personId: 7 }

beforeEach(() => {
  state.person = { id: 7, name: 'Dana Vaughn', assignedBroker: 'rebecca', isBrokerMailbox: false }
  state.latestSent = { ...CMA }
  state.bySlug = { ...CMA }
  state.recorded = []
  state.alerts = []
})

describe('routeCmaReplyToBroker', () => {
  it('stamps the document and names the address in the alert', async () => {
    expect(await routeCmaReplyToBroker({ personId: 7, channel: 'email' })).toBe(true)
    expect(state.recorded[0]).toMatchObject({ personId: 7, cmaId: 'c1', slug: 'cma-828-florida', channel: 'email' })
    expect(state.alerts[0]).toMatchObject({ broker: 'rebecca', personId: 7, kind: 'reply:cma:cma-828-florida' })
    expect(String(state.alerts[0].body)).toContain('Reply on 828 Florida, Bend, OR 97703 CMA')
    expect(String(state.alerts[0].body)).toContain('/admin/people/7')
  })

  it('fails closed when the contact does not resolve', async () => {
    state.person = null
    expect(await routeCmaReplyToBroker({ personId: 7, channel: 'sms' })).toBe(false)
    expect(state.alerts).toHaveLength(0)
    expect(state.recorded).toHaveLength(0)
  })

  it('says nothing when the contact has no sent CMA', async () => {
    state.latestSent = null
    expect(await routeCmaReplyToBroker({ personId: 7, channel: 'sms' })).toBe(false)
    expect(state.alerts).toHaveLength(0)
  })

  it('never texts a broker about their own mailbox', async () => {
    state.person = { id: 7, name: 'Matt Ryan', assignedBroker: 'matt', isBrokerMailbox: true }
    expect(await routeCmaReplyToBroker({ personId: 7, channel: 'email' })).toBe(false)
    expect(state.alerts).toHaveLength(0)
  })

  it('refuses a missing or nonsense person id without a read', async () => {
    expect(await routeCmaReplyToBroker({ personId: 0, channel: 'sms' })).toBe(false)
    expect(await routeCmaReplyToBroker({ personId: Number.NaN, channel: 'sms' })).toBe(false)
  })
})

describe('queueCmaOpenedAlert', () => {
  it('names who opened what, and links the lead', async () => {
    expect(await queueCmaOpenedAlert({ slug: 'cma-828-florida', crmPersonId: 7, trigger: 'document' })).toBe(true)
    expect(String(state.alerts[0].body)).toContain('Dana Vaughn opened the 828 Florida, Bend, OR 97703 report')
    expect(state.alerts[0].kind).toBe('return-visit:cma:cma-828-florida')
  })

  it('words an email open honestly rather than claiming a document view', async () => {
    await queueCmaOpenedAlert({ slug: 'cma-828-florida', crmPersonId: 7, trigger: 'email' })
    expect(String(state.alerts[0].body)).toContain('opened your 828 Florida, Bend, OR 97703 email')
  })

  it('falls back to the contact the document was sent to', async () => {
    await queueCmaOpenedAlert({ slug: 'cma-828-florida', crmPersonId: null, trigger: 'document' })
    expect(state.alerts[0].personId).toBe(7)
  })

  it('stays silent on a document that was never sent', async () => {
    state.bySlug = null
    expect(await queueCmaOpenedAlert({ slug: 'cma-828-florida', trigger: 'document' })).toBe(false)
    expect(state.alerts).toHaveLength(0)
  })

  it('stays silent when there is nobody to attribute the open to', async () => {
    state.bySlug = { ...CMA, personId: null }
    expect(await queueCmaOpenedAlert({ slug: 'cma-828-florida', trigger: 'document' })).toBe(false)
  })
})

describe('the alert kinds route to the broker preference switches', () => {
  it('a reply rides the new-lead switch and an open rides return-visit', () => {
    // If either falls through to 'other' it becomes UNGATED, and a broker who
    // switched these off would still be texted.
    expect(categoryForAlertKind('reply:cma:cma-828-florida')).toBe('reply')
    expect(categoryForAlertKind('return-visit:cma:cma-828-florida')).toBe('return_visit')
  })
})

describe('slug extraction', () => {
  it('reads the slug out of a tracked document url', () => {
    expect(cmaSlugFromDocumentUrl('https://ryan-realty.com/cma/cma-828-florida')).toBe('cma-828-florida')
    expect(cmaSlugFromDocumentUrl('https://ryan-realty.com/listings/123')).toBeNull()
    expect(cmaSlugFromDocumentUrl(null)).toBeNull()
  })

  it('reads the slug out of a cma email key and ignores every other send', () => {
    expect(cmaSlugFromEmailKey('cma:cma-828-florida')).toBe('cma-828-florida')
    expect(cmaSlugFromEmailKey('newsletter:412')).toBeNull()
    expect(cmaSlugFromEmailKey('seq:69:2')).toBeNull()
    expect(cmaSlugFromEmailKey(undefined)).toBeNull()
  })
})
