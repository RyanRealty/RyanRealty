const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const DELETE = process.env.DELETE === '1'

async function fub(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'GET') return await res.json()
  return res.status
}

// Final cleanup of residual legacy seller-touching tags
const TAGS_TO_REMOVE = [
  'Nurture Seller', 'auto:seller-seq:warm', 'auto:seller-seq:watch',
  'segment:my-leads',
]

for (const tag of TAGS_TO_REMOVE) {
  const j = await fub('GET', `/people?tags=${encodeURIComponent(tag)}&limit=100&fields=id,name,tags`)
  const people = j.people || []
  console.log(`Tag "${tag}": ${people.length} people`)

  if (!DELETE) continue

  for (const p of people) {
    const newTags = (p.tags || []).filter(t => t !== tag)
    // PUT with full tags array (NOT mergeTags=true) so we can remove
    const status = await fub('PUT', `/people/${p.id}`, { tags: newTags })
    if (status < 200 || status >= 300) console.log(`  FAIL id=${p.id} status=${status}`)
    await new Promise(r => setTimeout(r, 100))
  }
}
