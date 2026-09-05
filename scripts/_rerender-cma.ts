/**
 * Re-render one stored CMA from render_args. Numbers stay. Copy updates.
 * Does not call buildCma. Does not send.
 *
 *   npx tsx scripts/_rerender-cma.ts cma-2465-7th-redmond-97756
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

async function main() {
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { rebrandCma } = await import('@/lib/cma/rebrand')
  const slug = (process.argv[2] ?? '').trim().toLowerCase()
  if (!slug) {
    console.error('usage: npx tsx scripts/_rerender-cma.ts <slug>')
    process.exit(1)
  }
  const row = await getCmaAdminRowBySlug(slug)
  if (!row) {
    console.error(`✖ no cmas row for slug "${slug}"`)
    process.exit(1)
  }
  const brokerSlug = String(row.broker_slug ?? 'matthew-ryan')
  const result = await rebrandCma({ slug, brokerSlug })
  console.log(JSON.stringify({ slug, brokerSlug, result }, null, 2))
  if (!result.ok) process.exit(1)
}

main().catch((e) => {
  console.error('✖ rerender threw:', e)
  process.exit(1)
})
