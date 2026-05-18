const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const DELETE = process.env.DELETE === '1'

async function fub(method, path) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
  })
  if (method === 'GET') return await res.json()
  return res.status
}

const allTemplates = []
let next = '/templates?limit=100'
while (next) {
  const j = await fub('GET', next)
  for (const t of (j.templates || [])) allTemplates.push(t)
  const nl = j._metadata?.nextLink
  next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
}
console.log(`Total templates: ${allTemplates.length}`)

const ktsTemplates = allTemplates.filter(t => (t.name || '').startsWith('*KTS'))
console.log(`*KTS templates to delete: ${ktsTemplates.length}`)

if (!DELETE) {
  console.log('Dry run. Set DELETE=1.')
  process.exit(0)
}

let ok = 0, fail = 0
for (const t of ktsTemplates) {
  const status = await fub('DELETE', `/templates/${t.id}`)
  if (status >= 200 && status < 300) ok++
  else { fail++; console.log(`  FAIL id=${t.id} ${t.name} → ${status}`) }
  if (ok % 50 === 0) console.log(`  deleted ${ok}/${ktsTemplates.length}…`)
  await new Promise(r => setTimeout(r, 100))
}
console.log(`Done. Deleted: ${ok}, Failed: ${fail}`)
