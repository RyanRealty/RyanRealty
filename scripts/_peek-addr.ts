import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const rf = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return rf.call(this, req, ...args)
}
async function main() {
  const { findCmaSubjectByAddress } = await import('@/lib/data')
  const rows = await findCmaSubjectByAddress({ streetNumber: process.argv[2]!, streetNameIlike: `${process.argv[3]!}%`, cityIlike: 'Bend' })
  for (const r of rows as Array<Record<string, unknown>>) {
    const sf = Number(r.TotalLivingAreaSqFt ?? 0)
    const price = Number(r.ClosePrice ?? r.ListPrice ?? 0)
    console.log(`${r.StreetNumber} ${r.StreetName} | ${r.StandardStatus} | ${String(r.CloseDate ?? '').slice(0,10)} | $${price.toLocaleString()} | ${sf}sf | ${r.BedroomsTotal}bd/${r.BathroomsTotal}ba | ${sf>0?Math.round(price/sf):0}/sf | ${r.SubdivisionName}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
