#!/usr/bin/env node
/**
 * scripts/meta-apply-fixes.mjs
 *
 * Idempotent Meta Marketing API fixer. Applies every cleanup that
 * Meta's REST API actually accepts (verified empirically 2026-05-24):
 *
 *   1. ARCHIVE misconfigured lead forms (POST /{form_id} {status: ARCHIVED})
 *   2. AUDIT dead-pixel leak sources (GET /{pixel}/assigned_users + shared_accounts)
 *   3. REPORT what's locked (privacy_policy on ACTIVE forms returns
 *      {"success":true} but doesn't actually persist — Meta UI required)
 *
 * Run with:
 *   vercel env pull .env.tmp --environment=production --yes
 *   set -a && source .env.tmp && set +a
 *   node scripts/meta-apply-fixes.mjs --dry-run    # see what would change
 *   node scripts/meta-apply-fixes.mjs              # apply
 *   rm .env.tmp
 */

const DRY_RUN = process.argv.includes('--dry-run')

const TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || '').trim()
const PAGE_ID = (process.env.META_FB_PAGE_ID || '').trim()
const PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || '').trim()
const AD_ACCOUNT_ID = (process.env.META_AD_ACCOUNT_ID || '').trim()
const BUSINESS_ID = '733664948512665'

if (!TOKEN || !PAGE_ID || !PIXEL_ID || !AD_ACCOUNT_ID) {
  console.error('Missing required env: META_PAGE_ACCESS_TOKEN, META_FB_PAGE_ID, NEXT_PUBLIC_META_PIXEL_ID, META_AD_ACCOUNT_ID')
  process.exit(1)
}

async function fb(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(TOKEN)}`
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  const r = await fetch(url, init)
  const text = await r.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: r.status, ok: r.ok, body: parsed }
}

const findings = []
const applied = []
const blocked = []

console.log(`${'='.repeat(70)}\nMeta API Fixer — Page ${PAGE_ID} · Pixel ${PIXEL_ID}\nMode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n${'='.repeat(70)}\n`)

// ─── 1. Detect + archive misconfigured ACTIVE forms ──────────────────────
console.log('## 1. Lead-form quality check (ACTIVE only)\n')
const formsRes = await fb('GET', `${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count,questions&limit=100`)
const activeForms = (formsRes.body.data ?? []).filter((f) => f.status === 'ACTIVE')
console.log(`Found ${activeForms.length} ACTIVE forms.\n`)

const BAD_QUESTION_PATTERNS = [/inbox url/i, /select your private tour/i]

for (const f of activeForms) {
  const bogusQuestions = (f.questions ?? []).filter((q) => {
    const label = `${q.label ?? ''} ${q.key ?? ''}`.toLowerCase()
    return BAD_QUESTION_PATTERNS.some((re) => re.test(label))
  })
  if (bogusQuestions.length > 0) {
    const note = `Form ${f.id} "${f.name}" has bogus questions: ${bogusQuestions.map((q) => q.label).join(', ')} → archive recommended`
    console.log(`⚡ ${note}`)
    findings.push(note)
    if (!DRY_RUN) {
      const arch = await fb('POST', `${f.id}`, { status: 'ARCHIVED' })
      if (arch.ok) {
        console.log(`   ✓ archived (HTTP ${arch.status})`)
        applied.push(`archived form ${f.id} "${f.name}"`)
      } else {
        console.log(`   ✗ archive failed (HTTP ${arch.status}): ${JSON.stringify(arch.body).slice(0, 200)}`)
      }
    }
  } else {
    console.log(`✓ "${f.name}" (${f.id}) — no bogus questions`)
  }
}

// ─── 2. Note: privacy_policy on ACTIVE forms is API-write-but-not-persist ──
console.log('\n## 2. Lead-form privacy_policy (UI-locked on ACTIVE)\n')
console.log('   Meta accepts POST /{form_id} { privacy_policy: { url, link_text } }')
console.log('   with HTTP 200 {"success":true} but the field does not persist')
console.log('   on ACTIVE forms. This is a Meta-side lock.')
console.log('   ACTION: open https://business.facebook.com/latest/leads_forms and add')
console.log('   https://ryan-realty.com/privacy + "Privacy policy" link text to each')
console.log('   ACTIVE form in the Privacy & disclaimers section.\n')
blocked.push('lead-form privacy_policy on ACTIVE forms (Meta UI required)')

// ─── 3. Dead-pixel forensics ──────────────────────────────────────────────
console.log('## 3. Dead-pixel attribution leak forensics\n')
const ownedPixelsRes = await fb('GET', `${BUSINESS_ID}/owned_pixels?fields=id,name,last_fired_time`)
for (const px of ownedPixelsRes.body.data ?? []) {
  if (String(px.id) === String(PIXEL_ID)) continue
  const daysAgo = px.last_fired_time ? Math.floor((Date.now() - new Date(px.last_fired_time).getTime()) / 86400000) : null
  if (daysAgo === null || daysAgo > 30) continue
  console.log(`⚡ Pixel "${px.name}" (${px.id}) fired ${daysAgo}d ago — investigating source...`)
  const [assignedUsers, sharedAccts, agencies] = await Promise.all([
    fb('GET', `${px.id}/assigned_users?business=${BUSINESS_ID}`),
    fb('GET', `${px.id}/shared_accounts?business=${BUSINESS_ID}`),
    fb('GET', `${px.id}/agencies`),
  ])
  const users = (assignedUsers.body.data ?? []).filter((u) => u.id)
  const accts = (sharedAccts.body.data ?? []).filter((a) => a.id)
  const ags = (agencies.body.data ?? []).filter((a) => a.id)
  if (users.length > 0) {
    for (const u of users) {
      console.log(`   → Assigned user: "${u.name}" (${u.id}) tasks=[${(u.tasks ?? []).join(',')}]`)
      findings.push(`Dead pixel ${px.id} has assigned user "${u.name}" (${u.id}) — likely the source. Revoke via Business Settings → System Users.`)
    }
  }
  if (accts.length > 0) {
    for (const a of accts) {
      const isOurs = String(a.account_id) === String(AD_ACCOUNT_ID).replace(/^act_/, '')
      console.log(`   → Shared ad account: ${a.id}${isOurs ? ' (OURS)' : ' (NOT OURS)'}`)
      if (!isOurs) findings.push(`Dead pixel ${px.id} is shared with foreign ad account ${a.id} — likely the source.`)
    }
  }
  if (ags.length > 0) {
    for (const a of ags) console.log(`   → Agency: ${JSON.stringify(a).slice(0, 100)}`)
  }
  if (users.length === 0 && accts.length === 0 && ags.length === 0) {
    console.log('   (no assigned users / shared accounts / agencies — leak source not API-visible; check Events Manager Diagnostics)')
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}\nSummary\n${'='.repeat(70)}`)
if (applied.length > 0) {
  console.log('\n## Applied')
  for (const a of applied) console.log(`  ✓ ${a}`)
}
if (findings.length > 0) {
  console.log('\n## Findings')
  for (const f of findings) console.log(`  - ${f}`)
}
if (blocked.length > 0) {
  console.log('\n## Still UI-only (Meta does not accept the writes via API)')
  for (const b of blocked) console.log(`  - ${b}`)
}
console.log('')
