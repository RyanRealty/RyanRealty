// One-off: dump AP 69/70 full cadence + the email-template bodies they reference.
// Read-only. Used to mirror the cadence into tag-triggered Automations 2.0 and to
// show Matt the actual copy before anything goes live.
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const KEY = (env.match(/^FOLLOWUPBOSS_API_KEY=(.+)$/m) || env.match(/^FUB_API_KEY=(.+)$/m) || [])[1]?.trim()
if (!KEY) { console.error('no FUB key'); process.exit(1) }
const auth = 'Basic ' + Buffer.from(KEY + ':').toString('base64')
const BASE = 'https://api.followupboss.com/v1'

async function get(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: auth } })
  if (!r.ok) return { __err: r.status, __body: await r.text() }
  return r.json()
}

function stripHtml(s) {
  if (!s) return ''
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n')
          .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
          .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
          .replace(/&mdash;/g, '-').replace(/\n{3,}/g, '\n\n').trim()
}

const templateIds = new Set()
const out = []

for (const planId of [69, 70]) {
  const p = await get('/actionPlans/' + planId)
  out.push('')
  out.push('================================================================')
  out.push(`ACTION PLAN ${planId}: ${p.name}`)
  out.push('================================================================')
  out.push(`status=${p.status}  stopOnContacted=${p.stopOnContacted}  steps=${p.stepCount}`)
  out.push(`initial SMS enabled=${p.initialTextMessageEnabled}  delaySmsMinutes=${p.delaySmsMinutes}  from=${p.number || '(none)'}`)
  out.push(`initial SMS: ${p.initialTextMessage || '(none)'}`)
  out.push('--- steps ---')
  for (const s of p.steps || []) {
    let line = `  #${String(s.position).padStart(2)}  +${s.runAfterDays || 0}d  ${s.action}`
    if (s.emailTemplateId) { line += `  email-template=${s.emailTemplateId}`; templateIds.add(s.emailTemplateId) }
    if (s.taskName) line += `  task="${s.taskName}" (${s.taskType})`
    if (s.stageId) line += `  stage=${s.stageId}`
    if (s.tags && s.tags.length) line += `  tags=${JSON.stringify(s.tags)}`
    if (s.stopActionPlanId) line += `  stopPlan=${s.stopActionPlanId}`
    out.push(line)
  }
}

out.push('')
out.push('================================================================')
out.push('EMAIL TEMPLATE BODIES')
out.push('================================================================')
for (const id of [...templateIds].sort((a, b) => a - b)) {
  const t = await get('/templates/' + id)
  if (t.__err) { out.push(`\n[template ${id}] ERROR ${t.__err}: ${t.__body?.slice(0, 120)}`); continue }
  out.push('')
  out.push(`----- template ${id}: ${t.name || '(no name)'} -----`)
  out.push(`subject: ${t.subject || '(none)'}`)
  out.push('body:')
  out.push(stripHtml(t.body || t.bodyHtml || t.html || ''))
}

const text = out.join('\n')
console.log(text)
fs.mkdirSync(new URL('../out/fub-nurture/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL('../out/fub-nurture/ap-69-70-cadence.txt', import.meta.url), text)
console.log('\n\n[written to out/fub-nurture/ap-69-70-cadence.txt]')
