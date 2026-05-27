#!/usr/bin/env node
/**
 * Refresh full Meta inventory + write MASTER_LIST.md and index.html
 * Usage: source production env, then node scripts/meta-export-master-list.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'out/meta-seller-ads')

const TOKEN = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_TOKEN
const AD_ACCT = (process.env.META_AD_ACCOUNT_ID || '').startsWith('act_')
  ? process.env.META_AD_ACCOUNT_ID
  : `act_${process.env.META_AD_ACCOUNT_ID}`
const API = 'https://graph.facebook.com/v21.0'

async function get(path) {
  const r = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(TOKEN)}`)
  return r.json()
}

async function buildInventory() {
  const out = {
    generated_at: new Date().toISOString(),
    ad_account: AD_ACCT,
    ads_manager_url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCT.replace('act_', '')}`,
    page_id: process.env.META_FB_PAGE_ID || process.env.META_PAGE_ID,
    lead_forms: [
      { id: '2008523140027183', name: 'Seller home value (v6.x ads)' },
      { id: '970206419135413', name: 'Buyer listing alerts' },
    ],
    blocker: 'Housing non-discrimination certification required before new ads: https://facebook.com/certification/nondiscrimination',
    campaigns: [],
    audiences: [],
    local_files: [
      { path: 'scratch/phase2-fb-ad-campaign-v1.md', what: '6 draft ads A1–C1 (text only, click-to-LP)' },
      { path: 'docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md', what: 'Lead-form variants A/B/C' },
      { path: 'out/schoolhouse-just-sold/offer-first/', what: 'Offer-first JPGs (not in FB yet)' },
      { path: 'scratch/draft-ads-showcase.html', what: 'Local draft browser' },
      { path: 'scripts/meta-attach-seller-ads.mjs', what: 'Queue to upload after certification' },
    ],
  }

  const camps = await get(`${AD_ACCT}/campaigns?fields=id,name,effective_status,objective&limit=100`)
  for (const c of camps.data || []) {
    const row = { id: c.id, name: c.name, status: c.effective_status, objective: c.objective, adsets: [] }
    const sets = await get(`${c.id}/adsets?fields=id,name,effective_status,daily_budget,optimization_goal&limit=50`)
    for (const s of sets.data || []) {
      const as = {
        id: s.id,
        name: s.name,
        status: s.effective_status,
        budget_usd: s.daily_budget ? (s.daily_budget / 100).toFixed(2) : null,
        optimization: s.optimization_goal,
        ads: [],
      }
      const ads = await get(`${s.id}/ads?fields=id,name,effective_status,creative{id}&limit=50`)
      for (const a of ads.data || []) {
        const cr = await get(`${a.creative.id}?fields=object_story_spec,thumbnail_url`)
        const ld = cr.object_story_spec?.link_data || {}
        const vd = cr.object_story_spec?.video_data || {}
        as.ads.push({
          id: a.id,
          name: a.name,
          status: a.effective_status,
          creative_id: cr.id || a.creative?.id,
          headline: ld.name || vd.title || '',
          primary_text: ld.message || vd.message || '',
          cta: ld.call_to_action?.type || vd.call_to_action?.type || '',
          lead_form_id: ld.call_to_action?.value?.lead_gen_form_id || vd.call_to_action?.value?.lead_gen_form_id || '',
          thumbnail_url: cr.thumbnail_url || '',
        })
      }
      row.adsets.push(as)
    }
    out.campaigns.push(row)
  }

  const aud = await get(`${AD_ACCT}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound&limit=100`)
  out.audiences = (aud.data || [])
    .filter((a) => a.name?.startsWith('RR') || a.name?.includes('AUD-CORE') || a.name?.includes('FUB') || a.name?.includes('MLS'))
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.subtype,
      size: `${a.approximate_count_lower_bound ?? '?'}-${a.approximate_count_upper_bound ?? '?'}`,
    }))

  return out
}

function md(inv) {
  const lines = []
  lines.push('# Ryan Realty Meta — master list (everything in one place)')
  lines.push('')
  lines.push(`**Generated:** ${inv.generated_at}`)
  lines.push(`**Ads Manager:** ${inv.ads_manager_url}`)
  lines.push(`**Ad account:** ${inv.ad_account}`)
  lines.push('')
  lines.push('## Quick counts')
  const adCount = inv.campaigns.reduce((n, c) => n + c.adsets.reduce((m, s) => m + s.ads.length, 0), 0)
  const emptyTiers = inv.campaigns.filter((c) => c.name.startsWith('RR — Tier')).length
  lines.push(`- **${inv.campaigns.length}** campaigns`)
  lines.push(`- **${adCount}** live ads in Meta (with copy + thumbnails)`)
  lines.push(`- **${emptyTiers}** tier campaigns (shells, mostly no ads yet)`)
  lines.push(`- **${inv.audiences.length}** audiences listed below`)
  lines.push('')
  lines.push(`## Blocker for new ads`)
  lines.push(inv.blocker)
  lines.push('')
  lines.push('## Lead forms in use')
  for (const f of inv.lead_forms) {
    lines.push(`- \`${f.id}\` — ${f.name}`)
  }
  lines.push('')
  lines.push('## Audiences')
  lines.push('| ID | Name | Type | Size est. |')
  lines.push('|----|------|------|-----------|')
  for (const a of inv.audiences) {
    lines.push(`| ${a.id} | ${a.name} | ${a.subtype} | ${a.size} |`)
  }
  lines.push('')
  lines.push('## Campaigns and ads')
  for (const c of inv.campaigns) {
    lines.push(`### ${c.name}`)
    lines.push(`- Campaign ID: \`${c.id}\` · ${c.status} · ${c.objective}`)
    lines.push(`- [Open in Ads Manager](${inv.ads_manager_url}&selected_campaign_ids=${c.id})`)
    for (const s of c.adsets) {
      lines.push(`#### Ad set: ${s.name}`)
      lines.push(`- ID: \`${s.id}\` · ${s.status} · $${s.budget_usd}/day · ${s.optimization}`)
      if (s.ads.length === 0) lines.push('- **No ads**')
      for (const a of s.ads) {
        lines.push(`##### ${a.name}`)
        lines.push(`- Ad ID: \`${a.id}\` · ${a.status}`)
        lines.push(`- Headline: ${a.headline}`)
        lines.push(`- CTA: ${a.cta}${a.lead_form_id ? ` · form \`${a.lead_form_id}\`` : ''}`)
        if (a.primary_text) {
          lines.push('')
          lines.push(a.primary_text)
          lines.push('')
        }
      }
    }
    lines.push('')
  }
  lines.push('## Local files (not all in Meta)')
  for (const f of inv.local_files) {
    lines.push(`- \`${f.path}\` — ${f.what}`)
  }
  lines.push('')
  lines.push('## Refresh')
  lines.push('```bash')
  lines.push('vercel env pull /tmp/.env.production --environment=production --yes')
  lines.push('set -a && source /tmp/.env.production && set +a')
  lines.push('node scripts/meta-export-master-list.mjs')
  lines.push('```')
  return lines.join('\n')
}

function html(inv) {
  const data = JSON.stringify(inv)
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Meta master list</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#faf8f4;color:#102742}
header{padding:1rem 1.5rem;background:#102742;color:#faf8f4;position:sticky;top:0;z-index:1}
header a{color:#faf8f4}
main{padding:1.5rem;max-width:72rem}
input{width:100%;padding:.75rem;font-size:1rem;border:1px solid #ccc;border-radius:8px;margin-bottom:1rem}
section{background:#fff;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1rem;border:1px solid rgba(16,39,66,.12)}
h2{margin:.25rem 0 .5rem;font-size:1.15rem}
.meta{font-size:.85rem;color:#555}
.ad{border-top:1px solid #eee;padding-top:.75rem;margin-top:.75rem}
.ad img{max-width:120px;border-radius:6px;float:right;margin:0 0 .5rem .75rem}
pre{white-space:pre-wrap;font-size:.9rem;background:#f6f4ef;padding:.75rem;border-radius:6px}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th,td{border-bottom:1px solid #eee;padding:.4rem;text-align:left}
.tag{display:inline-block;background:#102742;color:#faf8f4;font-size:.7rem;padding:.15rem .4rem;border-radius:4px;margin-right:.35rem}
</style></head><body>
<header><h1 style="margin:0">Meta master list</h1>
<p style="margin:.35rem 0 0"><a href="${inv.ads_manager_url}">Open Ads Manager</a> · ${inv.generated_at}</p></header>
<main>
<input type="search" id="q" placeholder="Search campaigns, ads, headlines, copy…"/>
<div id="stats"></div>
<div id="audiences"></div>
<div id="campaigns"></div>
<div id="local"></div>
</main>
<script>
const INV = ${data};
const q = document.getElementById('q');
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function match(text, needle){ return !needle || (text||'').toLowerCase().includes(needle); }
function render(){
  const needle = q.value.trim().toLowerCase();
  const adCount = INV.campaigns.reduce((n,c)=>n+c.adsets.reduce((m,s)=>m+s.ads.length,0),0);
  document.getElementById('stats').innerHTML = '<section><strong>'+INV.campaigns.length+'</strong> campaigns · <strong>'+adCount+'</strong> ads · <a href="'+INV.ads_manager_url+'">Ads Manager</a><p class="meta">'+esc(INV.blocker)+'</p></section>';
  document.getElementById('audiences').innerHTML = '<section><h2>Audiences</h2><table><tr><th>ID</th><th>Name</th><th>Type</th><th>Size</th></tr>'+
    INV.audiences.filter(a=>match(a.name+a.id,needle)).map(a=>'<tr><td><code>'+a.id+'</code></td><td>'+esc(a.name)+'</td><td>'+a.subtype+'</td><td>'+a.size+'</td></tr>').join('')+'</table></section>';
  document.getElementById('campaigns').innerHTML = INV.campaigns.filter(c=>{
    if(match(c.name+c.id,needle)) return true;
    return c.adsets.some(s=>s.ads.some(a=>match(a.name+a.headline+a.primary_text,needle))||match(s.name,needle));
  }).map(c=>'<section><h2>'+esc(c.name)+'</h2><p class="meta"><span class="tag">'+c.status+'</span> '+c.objective+' · <code>'+c.id+'</code> · <a href="'+INV.ads_manager_url+'&selected_campaign_ids='+c.id+'">open</a></p>'+
    c.adsets.map(s=>'<div class="ad"><strong>'+esc(s.name)+'</strong> <span class="meta">$'+s.budget_usd+'/day · '+s.optimization+' · '+s.ads.length+' ads</span>'+
    s.ads.filter(a=>match(a.name+a.headline+a.primary_text,needle)).map(a=>'<div class="ad">'+(a.thumbnail_url?'<img src="'+a.thumbnail_url+'" alt=""/>':"")+'<div><strong>'+esc(a.name)+'</strong> <span class="meta">'+a.status+' · '+esc(a.headline)+'</span><pre>'+esc(a.primary_text)+'</pre></div></div>').join('')+'</div>').join('')+'</section>').join('');
  document.getElementById('local').innerHTML = '<section><h2>Local repo files</h2><ul>'+INV.local_files.map(f=>'<li><code>'+f.path+'</code> — '+esc(f.what)+'</li>').join('')+'</ul></section>';
}
q.addEventListener('input', render); render();
</script></body></html>`;
}

async function main() {
  if (!TOKEN) {
    console.error('Missing META_PAGE_ACCESS_TOKEN')
    process.exit(1)
  }
  await mkdir(OUT, { recursive: true })
  const inv = await buildInventory()
  await writeFile(resolve(OUT, 'full-inventory.json'), JSON.stringify(inv, null, 2) + '\n')
  await writeFile(resolve(OUT, 'MASTER_LIST.md'), md(inv) + '\n')
  await writeFile(resolve(OUT, 'index.html'), html(inv))
  console.log('Wrote:')
  console.log('  out/meta-seller-ads/MASTER_LIST.md')
  console.log('  out/meta-seller-ads/index.html')
  console.log('  out/meta-seller-ads/full-inventory.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
