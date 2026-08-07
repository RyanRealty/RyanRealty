import { describe, it, expect } from 'vitest'
import {
  resolveSigningBrokerForPerson,
  type SigningBrokerDb,
} from '@/lib/data/cma/signing-broker'

/**
 * Pins the locked directive (Matt, P3 2026-08-04 / restated 2026-08-06):
 * the lead's ASSIGNED broker signs; Matt is the fallback. Specifically pins
 * the crm_slug join — assigned_broker holds 'matt'/'rebecca'/'paul' while
 * brokers.slug holds the full web slug, so a slug-based match silently
 * signs everything as Matt. That silent-fallback bug is what this file
 * exists to keep dead.
 */

const REBECCA = {
  slug: 'rebecca-peterson',
  crm_slug: 'rebecca',
  display_name: 'Rebecca Peterson',
  email: 'rebeccapeterson@ryan-realty.com',
  twilio_number: '+15415550002',
  phone: '(415) 555-0001', // personal cell — INTERNAL ONLY
}
const MATT = {
  slug: 'matthew-ryan',
  crm_slug: 'matt',
  display_name: 'Matt Ryan',
  email: 'matt@ryan-realty.com',
  twilio_number: '+15417033095',
  phone: '(541) 703-3095',
}

/** Stub DB: records every query; answers from the fixtures above. */
function stubDb(opts: { assigned: string | null; personExists?: boolean }) {
  const queries: Array<{ table: string; col: string; val: unknown }> = []
  const db: SigningBrokerDb = {
    from(table: string) {
      return {
        select() {
          return {
            eq(col: string, val: unknown) {
              queries.push({ table, col, val })
              const finish = async () => {
                if (table === 'crm_people') {
                  if (opts.personExists === false) return { data: [] }
                  return { data: [{ assigned_broker: opts.assigned }] }
                }
                // brokers
                if (col === 'crm_slug' || queries.some((q) => q.table === 'brokers' && q.col === 'crm_slug')) {
                  const short = queries.find((q) => q.table === 'brokers' && q.col === 'crm_slug')?.val
                  if (short === 'rebecca') return { data: [REBECCA] }
                  if (short === 'matt') return { data: [MATT] }
                  if (queries.at(-1)?.col === 'slug' || col === 'slug') {
                    // fallback query after a failed crm_slug match
                    const s = queries.filter((q) => q.col === 'slug').at(-1)?.val
                    return { data: s === 'matthew-ryan' ? [MATT] : [] }
                  }
                  return { data: [] }
                }
                if (col === 'slug' || queries.some((q) => q.table === 'brokers' && q.col === 'slug')) {
                  const s = queries.filter((q) => q.col === 'slug').at(-1)?.val
                  return { data: s === 'matthew-ryan' ? [MATT] : [] }
                }
                return { data: [] }
              }
              return {
                eq(col2: string, val2: unknown) {
                  queries.push({ table, col: col2, val: val2 })
                  return { limit: () => finish() }
                },
                limit: () => finish(),
              }
            },
          }
        },
      }
    },
  }
  return { db, queries }
}

describe('resolveSigningBrokerForPerson (locked signing directive)', () => {
  it("resolves the lead's assigned broker via crm_slug — Rebecca signs Rebecca's lead", async () => {
    const { db, queries } = stubDb({ assigned: 'rebecca' })
    const broker = await resolveSigningBrokerForPerson(123, db)
    expect(broker.slug).toBe('rebecca-peterson')
    expect(broker.source).toBe('assigned')
    // The join MUST be on crm_slug, never brokers.slug — 'rebecca' is a short
    // slug and matching it against slug would silently fall back to Matt.
    const brokerLookup = queries.find((q) => q.table === 'brokers')
    expect(brokerLookup?.col).toBe('crm_slug')
  })

  it('phone is the publishable twilio_number; the personal cell only ever appears as notifyPhone', async () => {
    const { db } = stubDb({ assigned: 'rebecca' })
    const broker = await resolveSigningBrokerForPerson(123, db)
    expect(broker.phone).toBe(REBECCA.twilio_number)
    expect(broker.notifyPhone).toBe(REBECCA.phone)
    expect(broker.phone).not.toBe(REBECCA.phone)
  })

  it('exposes both slug spaces without mixing them', async () => {
    const { db } = stubDb({ assigned: 'rebecca' })
    const broker = await resolveSigningBrokerForPerson(123, db)
    expect(broker.slug).toBe('rebecca-peterson') // cmas rows / web space
    expect(broker.crmSlug).toBe('rebecca') // GA4 / crm_people space
  })

  it('falls back to Matt when the person has no assigned broker', async () => {
    const { db } = stubDb({ assigned: null })
    const broker = await resolveSigningBrokerForPerson(123, db)
    expect(broker.slug).toBe('matthew-ryan')
    expect(broker.source).toBe('fallback')
  })

  it('falls back to Matt when the person does not exist', async () => {
    const { db } = stubDb({ assigned: null, personExists: false })
    const broker = await resolveSigningBrokerForPerson(999999, db)
    expect(broker.slug).toBe('matthew-ryan')
    expect(broker.source).toBe('fallback')
  })

  it('falls back to Matt when personId is null (anonymous request)', async () => {
    const { db, queries } = stubDb({ assigned: null })
    const broker = await resolveSigningBrokerForPerson(null, db)
    expect(broker.slug).toBe('matthew-ryan')
    expect(broker.source).toBe('fallback')
    // Must not query crm_people at all for a null person.
    expect(queries.some((q) => q.table === 'crm_people')).toBe(false)
  })
})
