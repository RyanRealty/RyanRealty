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
  const { getCmaStoredHtmlBySlug } = await import('@/lib/data/cma/documents')
  const html = (await getCmaStoredHtmlBySlug(process.argv[2]!)) as string | null
  if (!html) { console.log('no html'); return }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const re = new RegExp(process.argv[3]!, 'gi')
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text)) && n < 12) {
    console.log('…' + text.slice(Math.max(0, m.index - 130), m.index + 200).trim() + '…\n')
    n++
  }
  if (n === 0) console.log(`no match for /${process.argv[3]}/ in ${text.length} chars of text`)
}
main().catch((e) => { console.error(e); process.exit(1) })
