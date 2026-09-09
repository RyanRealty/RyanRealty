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
// Read the marketing@ inbox over DWD and print the CMA mails delivered to the harness aliases.
const ALIASES = (process.argv[2] ?? 'avery,blake,casey').split(',').map((a) => `marketing+${a.trim()}@ryan-realty.com`)
async function main() {
  const { getGmailFor } = await import('@/lib/crm/gmail')
  const gmail = getGmailFor('marketing@ryan-realty.com', ['https://www.googleapis.com/auth/gmail.readonly'])
  if (!gmail) throw new Error('no DWD gmail client for marketing@')
  for (const alias of ALIASES) {
    const list = await gmail.users.messages.list({ userId: 'me', q: `deliveredto:${alias} newer_than:1d`, maxResults: 5 })
    const ids = list.data.messages ?? []
    console.log(`\n== ${alias}: ${ids.length} message(s)`)
    for (const m of ids) {
      const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
      const h = (n: string) => full.data.payload?.headers?.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
      const parts: any[] = []; const walk = (p: any) => { if (!p) return; parts.push(p); (p.parts ?? []).forEach(walk) }; walk(full.data.payload)
      const html = parts.find((p) => p.mimeType === 'text/html')?.body?.data
      const body = html ? Buffer.from(html, 'base64').toString('utf8') : ''
      const links = [...body.matchAll(/href="([^"]+)"/g)].map((x) => x[1]).filter((u) => /ryan-realty\.com|\/api\/track\//.test(u))
      console.log(`  id=${m.id} subject="${h('Subject')}" from=${h('From')} date=${h('Date')}`)
      console.log(`  text: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400)}`)
      console.log(`  tracked links (${links.length}):`); links.slice(0, 8).forEach((l) => console.log('    ' + l))
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
