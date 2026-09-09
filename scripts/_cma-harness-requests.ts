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
// One CMA request per harness alias, on a subject the engine already builds.
const REQUESTS = [
  { crmPersonId: 63297, leadName: 'Avery Alias', leadEmail: 'marketing+avery@ryan-realty.com', rawAddress: '2465 NE 7th St, Redmond, OR 97756', parsedStreet: '2465 NE 7th St', parsedCity: 'Redmond', parsedPostalCode: '97756' },
  { crmPersonId: 63425, leadName: 'Blake Alias', leadEmail: 'marketing+blake@ryan-realty.com', rawAddress: '1617 NW 8th St, Bend, OR 97703', parsedStreet: '1617 NW 8th St', parsedCity: 'Bend', parsedPostalCode: '97703' },
  { crmPersonId: 63426, leadName: 'Casey Alias', leadEmail: 'marketing+casey@ryan-realty.com', rawAddress: '19968 Terrace Dr, Bend, OR 97702', parsedStreet: '19968 Terrace Dr', parsedCity: 'Bend', parsedPostalCode: '97702' },
]
async function main() {
  const { createCmaRequest } = await import('@/lib/cma-request')
  for (const r of REQUESTS) {
    const res = await createCmaRequest({ ...r, parsedState: 'OR', requestSource: 'seller-lp', notifyLead: false } as any)
    console.log(r.leadName, JSON.stringify(res).slice(0, 300))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
