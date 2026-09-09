/**
 * The lead's half of the send walk: open a tracked CMA link from the harness
 * inbox in a FRESH headless Chrome profile (never the admin's own browser, whose
 * visitor id would be stitched to the alias by ?_pid), then tap one tracked
 * address link inside the document. Prints the redirect chain, the identity
 * cookies the site set, and the in-document tap so the DB rows can be checked.
 *
 *   npx tsx scripts/_cma-harness-click.ts '<tracked click url>'
 */
import puppeteer from 'puppeteer'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

async function main() {
  const url = process.argv[2]
  if (!url) throw new Error('usage: _cma-harness-click.ts <tracked url>')
  const token = new URL(url).searchParams.get('t') ?? ''
  const payload = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'))
  console.log('token payload', payload)

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setUserAgent(UA)
    await page.setViewport({ width: 1280, height: 900 })
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    console.log('landed', page.url(), res?.status())
    await new Promise((r) => setTimeout(r, 4000))
    const cookies = await page.cookies()
    console.log('cookies', cookies.filter((c) => /^rr_/.test(c.name)).map((c) => `${c.name}=${c.value.slice(0, 40)}`))
    const title = await page.title()
    console.log('title', title)
    // The document may live inside a frame; read anchors from every frame.
    const links: string[] = []
    for (const frame of page.frames()) {
      const found = await frame
        .$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
        .catch(() => [] as string[])
      links.push(...found.filter((h) => /ryan-realty\.com/.test(h) && /utm_campaign=/.test(h)))
    }
    console.log('frames', page.frames().length, 'anchors total', (await page.$$('a[href]')).length)
    console.log('tracked in-document links', links.length, links.slice(0, 5))
    const compLink = links.find((h) => /\/homes-for-sale\//.test(h) || /\/sold\//.test(h)) ?? links[0]
    if (compLink) {
      const r2 = await page.goto(compLink, { waitUntil: 'networkidle2', timeout: 60000 })
      console.log('tapped', compLink, '->', page.url(), r2?.status())
      await new Promise((r) => setTimeout(r, 4000))
    }
  } finally {
    await browser.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
