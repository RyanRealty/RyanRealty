/**
 * Extract housing-market closed-sales figures from production HTML.
 *
 *   npx tsx scripts/loop-probe-housing-market-figures-v13.ts
 */
async function main() {
  const res = await fetch('https://ryan-realty.com/housing-market', {
    headers: { 'user-agent': 'RyanRealty-loop-probe/housing-market-figures-v13' },
  })
  const html = await res.text()
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const closes = [...body.matchAll(/([\d,]+)\s+([A-Za-z /.-]+ closes)/gi)].map((m) => ({
    n: Number(m[1].replace(/,/g, '')),
    label: m[2].trim(),
  }))
  const allType = closes.find((c) => /ALL-TYPE/i.test(c.label))
  const cats = closes.filter((c) => !/ALL-TYPE/i.test(c.label))
  const uniqueCats = [...new Map(cats.map((c) => [c.label, c])).values()]
  const sum = uniqueCats.reduce((s, c) => s + c.n, 0)
  console.log(
    JSON.stringify(
      {
        status: res.status,
        allType,
        uniqueCats,
        sum,
        delta: allType ? sum - allType.n : null,
        farm: /Farm|ranch/i.test(body),
        other: /\bOther closes\b/i.test(body),
        chartDump: body.match(/Single-family \/ residential[:,]?\s*[\d,]+[\s\S]{0,240}/)?.[0] ?? null,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
