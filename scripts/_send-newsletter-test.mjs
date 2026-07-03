// Scratch: email the v2 newsletter design mockup to Matt as a real-inbox test.
// One recipient only (matt@ryan-realty.com), his explicit request. Sample data.
import { readFileSync } from 'node:fs'

function envVal(key) {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const line = raw.split('\n').find((l) => l.startsWith(key + '='))
  if (!line) return null
  let v = line.slice(key.length + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return v
}

const KEY = envVal('RESEND_API_KEY')
if (!KEY) { console.error('no RESEND_API_KEY'); process.exit(1) }

// Email-safe twin (table-based, bulletproof, gauge as a static meter).
const html = readFileSync(new URL('../design_system/ryan-realty/ui_kits/newsletter/email.html', import.meta.url), 'utf8')

const TO = 'matt@ryan-realty.com'
const SUBJECTS = ["[DRAFT v7 · brand voice] The Bend Brief — updated " + new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Los_Angeles'})] // distinct so Gmail won't thread

async function send(from) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [TO],
      reply_to: 'matt@ryan-realty.com',
      subject: SUBJECTS[0],
      html,
    }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, from }
}

// Best test = the real bulk domain. Fall back to the verified mail. domain if news. isn't ready.
let r = await send('Matt Ryan · Ryan Realty <newsletter@news.ryan-realty.com>')
if (r.status >= 400) {
  console.log('news. send failed:', JSON.stringify(r.body).slice(0, 200), '\n→ retrying from mail.ryan-realty.com')
  r = await send('Matt Ryan · Ryan Realty <newsletter@mail.ryan-realty.com>')
}
console.log(JSON.stringify({ status: r.status, id: r.body?.id, error: r.body?.message || r.body?.name, from: r.from }, null, 2))
