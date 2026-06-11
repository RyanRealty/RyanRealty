#!/usr/bin/env node
// Meta (Facebook/Instagram) ad performance + status.
// Run: node --env-file=.env.local scripts/_meta-ads-check.mjs
const V = 'v21.0'
const token = (process.env.META_USER_ACCESS_TOKEN || '').trim()
let acct = (process.env.META_AD_ACCOUNT_ID || '').trim()
if (acct && !acct.startsWith('act_')) acct = 'act_' + acct

async function fb(pathq) {
  const sep = pathq.includes('?') ? '&' : '?'
  const r = await fetch(`https://graph.facebook.com/${V}/${pathq}${sep}access_token=${encodeURIComponent(token)}`)
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j
}
const leadsOf = (actions) => (actions || []).filter((a) => /lead/i.test(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0)

if (!token || !acct) { console.log('Missing META_USER_ACCESS_TOKEN or META_AD_ACCOUNT_ID'); process.exit(1) }
console.log(`Ad account: ${acct}\n`)

// ── account-level totals over two windows ────────────────────────────────────
for (const preset of ['last_30d', 'last_90d']) {
  try {
    const j = await fb(`${acct}/insights?date_preset=${preset}&fields=spend,impressions,clicks,ctr,cpc,reach,actions`)
    const d = (j.data || [])[0]
    if (!d) { console.log(`Account totals (${preset}): no delivery in window`); continue }
    const leads = leadsOf(d.actions)
    const cpl = leads ? (Number(d.spend) / leads).toFixed(2) : 'n/a'
    console.log(`Account totals (${preset}): spend $${d.spend} | impr ${d.impressions} | clicks ${d.clicks} | CTR ${Number(d.ctr).toFixed(2)}% | CPC $${Number(d.cpc).toFixed(2)} | reach ${d.reach} | leads ${leads} | cost/lead $${cpl}`)
  } catch (e) { console.log(`Account totals (${preset}) ERR: ${e.message.slice(0, 120)}`) }
}

// ── campaign roster + delivery status ────────────────────────────────────────
const camps = (await fb(`${acct}/campaigns?fields=name,status,effective_status,objective,daily_budget,lifetime_budget&limit=200`)).data || []
const active = camps.filter((c) => c.effective_status === 'ACTIVE')
console.log(`\nCampaigns: ${camps.length} total  |  ACTIVE: ${active.length}  |  not running: ${camps.length - active.length}`)
for (const c of camps) {
  const b = c.daily_budget ? `$${(c.daily_budget / 100).toFixed(0)}/day` : c.lifetime_budget ? `$${(c.lifetime_budget / 100).toFixed(0)} lifetime` : 'budget at adset'
  console.log(`  [${c.effective_status}] ${c.name}  (obj:${c.objective || '?'}, ${b})`)
}

// ── per-campaign performance (last 90d) ──────────────────────────────────────
try {
  const ci = (await fb(`${acct}/insights?level=campaign&date_preset=last_90d&fields=campaign_name,spend,impressions,clicks,ctr,actions&limit=200`)).data || []
  console.log('\nPer-campaign delivery (last 90 days):')
  if (!ci.length) console.log('  (no delivery in the last 90 days — nothing has spent)')
  ci.sort((a, b) => Number(b.spend) - Number(a.spend))
  for (const c of ci) console.log(`  ${c.campaign_name}: $${c.spend} | ${c.impressions} impr | ${c.clicks} clk | CTR ${Number(c.ctr || 0).toFixed(2)}% | leads ${leadsOf(c.actions)}`)
} catch (e) { console.log('Per-campaign ERR:', e.message.slice(0, 120)) }
