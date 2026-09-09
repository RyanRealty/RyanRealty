import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}
// SEND WALK TWO — the expired and FSBO lanes, through the paths those lanes use.
// Recipients are harness aliases (our own mailbox), never a real owner.
const REQUESTS = [
  {
    lane: 'expired',
    requestSource: 'expired-listing-cron' as const,
    crmPersonId: 63427,
    leadName: 'Dana Alias',
    leadEmail: 'marketing+dana@ryan-realty.com',
    rawAddress: '2465 NE 7th St, Redmond, OR 97756',
    parsedStreet: '2465 NE 7th St',
    parsedCity: 'Redmond',
    parsedPostalCode: '97756',
  },
  {
    lane: 'fsbo',
    requestSource: 'fsbo-cron' as const,
    crmPersonId: 63428,
    leadName: 'Erin Alias',
    leadEmail: 'marketing+erin@ryan-realty.com',
    rawAddress: '19968 Terrace Dr, Bend, OR 97702',
    parsedStreet: '19968 Terrace Dr',
    parsedCity: 'Bend',
    parsedPostalCode: '97702',
  },
]
async function main() {
  const { createCmaRequest } = await import('@/lib/cma-request')
  for (const r of REQUESTS) {
    const { lane, ...input } = r
    const res = await createCmaRequest({ ...input, parsedState: 'OR', notifyLead: false, notifyBroker: false } as never)
    console.log(lane, JSON.stringify(res))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
