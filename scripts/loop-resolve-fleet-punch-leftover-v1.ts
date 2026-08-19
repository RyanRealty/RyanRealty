/**
 * Resolve verified FLEET-PUNCH leftovers already live on READY 0957bb6cb.
 *
 *   npx tsx scripts/loop-resolve-fleet-punch-leftover-v1.ts
 *
 * Does NOT complete FLEET-PUNCH.
 */
import { createClient } from '@supabase/supabase-js'
import { appendPunchDispositions, openPunchLines, type PunchDisposition } from '../lib/data/loop/fleet-intake-core'

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const SHA = '0957bb6cb'
const DPL = 'dpl_XYyzoRaJasFixotdGFLTCF4Qf4Zt'
const LIVE = `READY ${SHA} ${DPL}`

const RESOLUTIONS: PunchDisposition[] = [
  {
    fingerprint: '6e4c1a13e765747edf4f8eb74a09753f',
    status: 'fixed',
    note: `/neighborhoods H1 is "Bend, neighborhood by neighborhood." Smash gone. ${LIVE}.`,
  },
  {
    fingerprint: 'd0eff5852b4c8d9eec136c87400b7e31',
    status: 'fixed',
    note: `/subdivisions/1925-townhomes H1 is "1925 Townhomes, Homes for Sale". ${LIVE}.`,
  },
  {
    fingerprint: '1ba8356efd018270b0e8fcac39ecb4d1',
    status: 'fixed',
    note: `1925 Townhomes hero is "1 home for sale", not "1 homes". ${LIVE}.`,
  },
  {
    fingerprint: 'fdb3c6ed3f4a63db51de28ca23952449',
    status: 'fixed',
    note: `Bend Farmers Market nearby source no longer claims a listings timeout. ${LIVE}.`,
  },
  {
    fingerprint: 'ce89f2636d9dee565d989ee26b554edd',
    status: 'fixed',
    note: `Hayden Homes Amphitheater timeout source omitted when listings loaded. ${LIVE}.`,
  },
  {
    fingerprint: '549f46a83cb353814596dccb6500f0a1',
    status: 'fixed',
    note: `Tower Theatre timeout source omitted when listings loaded. ${LIVE}.`,
  },
  {
    fingerprint: 'a83adc348e05e668c135440fcd273445',
    status: 'fixed',
    note: `Smith Rock timeout source omitted next to live nearby counts. ${LIVE}.`,
  },
  {
    fingerprint: '291f0aa3884235a837c578b7dfc2a306',
    status: 'fixed',
    note: `Tetherow golf timeout source omitted next to live nearby counts. ${LIVE}.`,
  },
  {
    fingerprint: 'cedacf966fb8c02a2ec4a7047b1a5836',
    status: 'fixed',
    note: `Summit High timeout source omitted next to live nearby counts. ${LIVE}.`,
  },
  {
    fingerprint: '1cd45465cf87988e4f99db65c46e93a8',
    status: 'fixed',
    note: `/join breadcrumb uses crumb--on-media on bg-primary/70. ${LIVE}.`,
  },
  {
    fingerprint: 'c5da69b40e4e1300570ba5e52dc5e0b2',
    status: 'fixed',
    note: `/dmca designated agent is Matt Ryan, 115 NW Oregon Ave #2, 541.703.3095, matt@ryan-realty.com. ${LIVE}.`,
  },
  {
    fingerprint: '5a5c19986a65dc29ac115b4c62cd1301',
    status: 'fixed',
    note: `404 og:title is Page not found. No homepage og:url. ${LIVE}.`,
  },
  {
    fingerprint: 'cca96576f53717aba19dff7c4d430645',
    status: 'fixed',
    note: `404 robots are noindex. The index,follow conflict is gone. ${LIVE}.`,
  },
  {
    fingerprint: '540b45d89c14315f78076f27ee537133',
    status: 'fixed',
    note: `404 no longer reuses homepage og:title or marketing description. ${LIVE}.`,
  },
  {
    fingerprint: '420bece251d65c7af5e3d69e9af9e323',
    status: 'fixed',
    note: `404 no longer ships index, follow against noindex. ${LIVE}.`,
  },
  {
    fingerprint: 'd16dc4aa7c506ff12f7a9126e34923be',
    status: 'fixed',
    note: `404 og:title is Page not found, not the homepage title. ${LIVE}.`,
  },
  {
    fingerprint: 'cbb1b3bd573f85722966b4ecf6711f86',
    status: 'fixed',
    note: `Blog related heading is Related posts; second block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: '2b20e415a778aa7f6a3169630867668d',
    status: 'fixed',
    note: `Same class: second keep-reading block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: '5ec0d63d3577d8307a910e90b7a51d9c',
    status: 'fixed',
    note: `Same class: second keep-reading block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: 'b75bad1a55e30768e13d82f09f5a5e87',
    status: 'fixed',
    note: `Same class: second keep-reading block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: 'fd283253696afedbd4214e14101eb6d5',
    status: 'fixed',
    note: `Same class: second keep-reading block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: '562356483b8a68f60098f20d98bbacf4',
    status: 'fixed',
    note: `Same class: second keep-reading block is Next steps. ${LIVE}.`,
  },
  {
    fingerprint: '8673f5fca623892bd90d46c7eaff5811',
    status: 'fixed',
    note: `Kouns Drive listing H1 is Kouns Drive, not Drive Drive. ${LIVE}.`,
  },
  {
    fingerprint: 'a0195fc0534daaf95a7f0ad4f0ded577',
    status: 'fixed',
    note: `/team/matthew-ryan ledger lists Sold/Bought rows for the Homes closed 19 figure. ${LIVE}.`,
  },
  {
    fingerprint: 'e098d679d15770a780317bd6a9828f64',
    status: 'fixed',
    note: `Same class: Matt closed-sales ledger is not capped at 9. ${LIVE}.`,
  },
  {
    fingerprint: '6f5aec4b72611908a1f18b38f15133ca',
    status: 'rejected',
    note: `/open-houses vis HTML has H1 "Open houses in Central Oregon". Missing-H1 did not reproduce. ${LIVE}.`,
  },
  {
    fingerprint: '3f09166d24b43d08d01b1371706b6463',
    status: 'rejected',
    note: `60835 Jennings vis HTML has "Listing courtesy of Cascade Hasson SIR". ${LIVE}.`,
  },
  {
    fingerprint: 'e65c02794ce573f154a76083af152745',
    status: 'rejected',
    note: `Same class: listing-detail vis HTML includes Listing courtesy of. ${LIVE}.`,
  },
  {
    fingerprint: 'e9e7e470c5ce7bb608753342b96e63b8',
    status: 'rejected',
    note: `Same class: listing-detail vis HTML includes Listing courtesy of. ${LIVE}.`,
  },
  {
    fingerprint: 'acb21040c2f596b5d7a83d78ee153a64',
    status: 'rejected',
    note: `Same class: listing-detail vis HTML includes Listing courtesy of. ${LIVE}.`,
  },
  {
    fingerprint: '719678d077b47d17a0e55fe0daaceed5',
    status: 'rejected',
    note: `Same class: listing-detail vis HTML includes Listing courtesy of. ${LIVE}.`,
  },
  {
    fingerprint: 'f4a20eae984eb15035c5f27733698cd8',
    status: 'rejected',
    note: `Same class: listing-detail vis HTML includes Listing courtesy of. ${LIVE}.`,
  },
  {
    fingerprint: '4204feab76563676f21ad3317632e5aa',
    status: 'rejected',
    note: `/team/matt-ryan is the alias; canonical is /team/matthew-ryan. ${LIVE}.`,
  },
  {
    fingerprint: '7090f4fade3cb7739ea4bfffa6bd5d36',
    status: 'rejected',
    note: `Homepage vis HTML does not smash Central OregonHomes / Namedcommunities / On themarket. ${LIVE}.`,
  },
  {
    fingerprint: '08616978f36fdc1b35808c2034b08de6',
    status: 'rejected',
    note: `Same class: homepage smash strings are absent in vis HTML. ${LIVE}.`,
  },
  {
    fingerprint: '17a927929eae031d1c0a8d6f81a115b5',
    status: 'rejected',
    note: `/places/eagle-crest is HTTP 404. Eagle Crest lives at /communities/eagle-crest. ${LIVE}.`,
  },
  {
    fingerprint: '67e4deead6e6bc9cca11a9892b8df815',
    status: 'rejected',
    note: `/activity: is HTTP 404. Canonical /activity vis HTML has no status_active. ${LIVE}.`,
  },
  {
    fingerprint: '51600784867979c82bbf9ec22628e379',
    status: 'rejected',
    note: `Same class: /activity: 404. Human labels live on /activity. ${LIVE}.`,
  },
  {
    fingerprint: 'c54493c556a8e820cf4d7f2cae2594c5',
    status: 'rejected',
    note: `Same class: /activity: 404. ${LIVE}.`,
  },
  {
    fingerprint: '73d015f7241f6f01194b7689f26c0ba1',
    status: 'rejected',
    note: `/activity vis HTML has no status_active. ${LIVE}.`,
  },
  {
    fingerprint: 'c0322fc25ebd5f396675a25e1f8c3ab2',
    status: 'rejected',
    note: `Lifestyle staging post: related-homes rail withheld by publish-blog-related-homes. ${LIVE}.`,
  },
  {
    fingerprint: 'c8dff942f20beb845e4619904be6f317',
    status: 'rejected',
    note: `ADU policy post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: 'a6656fa30a97f73fc5b30b303cc4d321',
    status: 'rejected',
    note: `SB 1537 policy post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: 'febf0c40b17040761acd81bb53c332a3',
    status: 'rejected',
    note: `Juniper Ridge housing-strategy post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: 'f5687c5a7bf434d3868755f4403a66ff',
    status: 'rejected',
    note: `Working-remote lifestyle post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: '18beea79c09b585ffaf0bececddadafd',
    status: 'rejected',
    note: `Building-permit timeline post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: '35159a01df18e100174e44ca63245a26',
    status: 'rejected',
    note: `Infrastructure post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: '494e35d7e854e957407865eeede0e514',
    status: 'rejected',
    note: `SDC methodology post is not a buyable-place rail. ${LIVE}.`,
  },
  {
    fingerprint: '4c4449afefb40073046902a87b074378',
    status: 'rejected',
    note: `Wildfire-standards post is not a buyable-place rail. ${LIVE}.`,
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,state,title,objective,owner_session')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }
  const objective = appendPunchDispositions(String(row.objective ?? ''), RESOLUTIONS)
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({ objective, updated_at: new Date().toISOString() })
    .eq('id', ID)
    .select('id,objective,state,owner_session')
    .single()
  if (error || !data?.id) {
    console.error('resolve failed', error?.message ?? 'no row')
    process.exit(1)
  }
  const openRemaining = openPunchLines(String(data.objective ?? '')).length
  console.log(JSON.stringify({ resolved: true, id: data.id, openRemaining, appended: RESOLUTIONS.length }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
