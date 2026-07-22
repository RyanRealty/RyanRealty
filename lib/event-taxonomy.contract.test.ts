// W1.3 — event-taxonomy contract. The client (components/VisitTracker.tsx,
// FirstPartyEventType) and the server (app/api/visitors/track/route.ts,
// ALLOWED_EVENT_TYPES) are two separate lists; the tracker comment only ASKS
// (in prose) that the client stay a subset of the server. This pins it
// mechanically: a client event type the /api/visitors/track route would 400 on
// fails CI. Static text-parse of both sources (no imports, so no client/server
// module side effects leak into vitest).
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const CLIENT = 'components/VisitTracker.tsx'
const SERVER = 'app/api/visitors/track/route.ts'

function clientEventTypes(): string[] {
  const src = readFileSync(CLIENT, 'utf8')
  const m = src.match(/export type FirstPartyEventType =([\s\S]*?)\n\n/)
  if (!m) throw new Error(`FirstPartyEventType union not found in ${CLIENT}`)
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}
function serverAllowed(): Set<string> {
  const src = readFileSync(SERVER, 'utf8')
  const m = src.match(/const ALLOWED_EVENT_TYPES = new Set<string>\(\[([\s\S]*?)\]\)/)
  if (!m) throw new Error(`ALLOWED_EVENT_TYPES not found in ${SERVER}`)
  return new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))
}

describe('first-party event taxonomy (W1.3 contract)', () => {
  it('every client FirstPartyEventType is accepted by the server ALLOWED_EVENT_TYPES', () => {
    const client = clientEventTypes()
    const server = serverAllowed()
    expect(client.length).toBeGreaterThan(0)
    const rejected = client.filter((t) => !server.has(t))
    expect(
      rejected,
      `client fires event types the /api/visitors/track route would 400: ${rejected.join(', ')}`,
    ).toEqual([])
  })

  it('scroll_depth + search are in BOTH taxonomies (the W1.3 first-party surfaces)', () => {
    const client = new Set(clientEventTypes())
    const server = serverAllowed()
    for (const t of ['scroll_depth', 'search']) {
      expect(client.has(t), `${t} missing from client FirstPartyEventType`).toBe(true)
      expect(server.has(t), `${t} missing from server ALLOWED_EVENT_TYPES`).toBe(true)
    }
  })
})
