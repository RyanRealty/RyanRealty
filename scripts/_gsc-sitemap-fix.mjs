#!/usr/bin/env node
// Fix GSC sitemaps: remove the obsolete Yoast/WordPress sitemaps, resubmit the
// current Next.js /sitemap.xml. Run: node --env-file=.env.local scripts/_gsc-sitemap-fix.mjs
import { google } from 'googleapis'

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/webmasters'], // full = submit + delete
})
const wm = google.webmasters({ version: 'v3', auth })
const siteUrl = 'https://ryan-realty.com/'
const NEW = 'https://ryan-realty.com/sitemap.xml'
const OLD = [
  'https://ryan-realty.com/sitemap_index.xml',
  'https://ryan-realty.com/page-sitemap.xml',
  'https://ryan-realty.com/post-sitemap.xml',
]
const UA = 'Mozilla/5.0 (Macintosh) Chrome/124'
const liveStatus = async (u) => { try { return (await fetch(u, { redirect: 'manual', headers: { 'user-agent': UA } })).status } catch { return 'ERR' } }

// 0) safety: confirm live status before deleting
console.log('Live status on the new site (confirm old ones are dead before removing):')
for (const u of [NEW, ...OLD]) console.log(`  ${await liveStatus(u)}  ${u.replace('https://ryan-realty.com/', '/')}`)

// 1) remove obsolete Yoast sitemaps
console.log('\nRemoving obsolete WordPress sitemaps from Search Console:')
for (const u of OLD) {
  try { await wm.sitemaps.delete({ siteUrl, feedpath: u }); console.log(`  removed: ${u.replace('https://ryan-realty.com/', '/')}`) }
  catch (e) { console.log(`  FAILED ${u}: ${e?.message?.slice(0, 140)}`) }
}

// 2) resubmit the current sitemap (re-triggers a fresh fetch + reprocess)
console.log('\nResubmitting the current sitemap:')
try { await wm.sitemaps.submit({ siteUrl, feedpath: NEW }); console.log(`  resubmitted: /sitemap.xml`) }
catch (e) { console.log(`  FAILED: ${e?.message?.slice(0, 140)}`) }

// 3) confirm final registry
console.log('\nFinal sitemap registry in Search Console:')
const sm = (await wm.sitemaps.list({ siteUrl })).data.sitemap || []
if (!sm.length) console.log('  (none)')
for (const s of sm) {
  const c = (s.contents || []).map((x) => `${x.type}=${x.submitted}`).join(', ')
  console.log(`  ${s.path}  — downloaded:${s.lastDownloaded || 'pending'} pending:${s.isPending || false} errors:${s.errors || 0} warnings:${s.warnings || 0}${c ? '  [' + c + ']' : ''}`)
}
