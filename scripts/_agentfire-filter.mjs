import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('tmp/agentfire/email-hunt.json', 'utf8'))
// dedup by message id (admin@/info@ mirror matt@)
const byId = new Map()
for (const m of all) if (!byId.has(m.id)) byId.set(m.id, m)
const msgs = [...byId.values()]

const CAT = {
  ACCESS: /welcome|get ?started|set ?up|onboard|your account|account is|log ?in|sign ?in|password|reset|credential|username|wp-?admin|dashboard|activate|invitation|invite/i,
  BILLING: /invoice|receipt|billing|subscription|payment|renew|charged|charge|credit card|plan|cancel|refund|past due|failed payment/i,
  MEDIA: /export|download|backup|migrat|content|wp-content|\.zip|media library|your (photos|images|files)|asset/i,
}
function cat(m) {
  const hay = `${m.subject || ''} ${m.snippet || ''}`
  const hits = []
  for (const [k, re] of Object.entries(CAT)) if (re.test(hay)) hits.push(k)
  return hits
}
function excerpt(m, re) {
  const b = m.bodyPreview || ''
  const i = b.search(re)
  if (i < 0) return b.slice(0, 300).replace(/\n+/g, ' ')
  return ('…' + b.slice(Math.max(0, i - 120), i + 280) + '…').replace(/\n+/g, ' ')
}

for (const C of ['ACCESS', 'BILLING', 'MEDIA']) {
  const list = msgs.filter((m) => cat(m).includes(C)).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
  console.log(`\n${'='.repeat(70)}\n${C}  (${list.length} messages)\n${'='.repeat(70)}`)
  for (const m of list) {
    console.log(`\n• ${m.date}  | ${m.from}`)
    console.log(`  SUBJ: ${m.subject}`)
    console.log(`  WHY:  ${excerpt(m, CAT[C]).slice(0, 380)}`)
    const goodLinks = (m.links || []).filter((u) => /agentfire|wp-admin|login|account|billing|invoice|cancel|stripe|recurly|chargebee|export|download/i.test(u) && !/\.png|\.jpg|hubspotemail|logo/i.test(u))
    if (goodLinks.length) console.log('  LINKS: ' + goodLinks.slice(0, 6).join('  '))
    if (m.attachments?.length) console.log('  ATT: ' + m.attachments.map((a) => `${a.filename} (${a.mimeType})`).join(', '))
  }
}
// Also: the very earliest AgentFire emails overall (account origin)
console.log(`\n${'='.repeat(70)}\nEARLIEST 6 agentfire emails (account origin)\n${'='.repeat(70)}`)
for (const m of msgs.slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).slice(0, 6)) {
  console.log(`\n• ${m.date} | ${m.from}\n  SUBJ: ${m.subject}\n  SNIP: ${(m.snippet || '').slice(0, 200)}`)
}
console.log(`\nTotal unique agentfire messages: ${msgs.length}`)
