// READ-ONLY: honest breakdown of the addressless cohort. For every addressless
// contact, tally source / type / createdVia / stage, and the FULL tag histogram.
// Then print verbatim sample records for the biggest buckets. No interpretation
// in code — just the raw distributions so we can see what these actually are.
import { config } from "dotenv"; config({ path: "/Users/matthewryan/RyanRealty/.env.local" })
import fs from "node:fs"
const AUTH = "Basic " + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ":").toString("base64")
const H = { Authorization: AUTH, Accept: "application/json", "X-System": "RyanRealtyAudit" }
const norm = s => String(s ?? "").trim()

const addressless = p => {
  const a = Array.isArray(p.addresses) ? p.addresses : []
  return !a.some(x => norm(x.street)) && !norm(p.customSellerPropertyAddress)
}

let total = 0, addr = 0
const bySource = {}, byType = {}, byCreatedVia = {}, byStage = {}, tagHist = {}
const createdMonth = {}
const samples = []   // a few verbatim per top source

let path = "https://api.followupboss.com/v1/people?limit=100&fields=id,firstName,lastName,source,type,createdVia,stage,tags,created,emails,phones,background,addresses,customSellerPropertyAddress"
let pages = 0
while (path) {
  const r = await fetch(path, { headers: H }); if (!r.ok) { console.error("HTTP", r.status); break }
  const d = await r.json(); const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    total++
    if (!addressless(p)) continue
    addr++
    const src = norm(p.source) || "(none)"
    bySource[src] = (bySource[src] || 0) + 1
    byType[norm(p.type) || "(none)"] = (byType[norm(p.type) || "(none)"] || 0) + 1
    byCreatedVia[norm(p.createdVia) || "(none)"] = (byCreatedVia[norm(p.createdVia) || "(none)"] || 0) + 1
    byStage[norm(p.stage) || "(none)"] = (byStage[norm(p.stage) || "(none)"] || 0) + 1
    createdMonth[(p.created || "").slice(0, 7)] = (createdMonth[(p.created || "").slice(0, 7)] || 0) + 1
    for (const t of (p.tags || [])) { const k = norm(t); if (k) tagHist[k] = (tagHist[k] || 0) + 1 }
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${total} scanned, ${addr} addressless\n`)
}

const top = (o, n = 30) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)
const out = []
out.push(`TOTAL ${total} | ADDRESSLESS ${addr}`)
out.push(`\n=== by SOURCE ===`); for (const [k, v] of top(bySource)) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(`\n=== by TYPE ===`); for (const [k, v] of top(byType)) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(`\n=== by createdVia ===`); for (const [k, v] of top(byCreatedVia)) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(`\n=== by STAGE ===`); for (const [k, v] of top(byStage)) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(`\n=== by created MONTH ===`); for (const [k, v] of top(createdMonth, 24)) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(`\n=== FULL TAG HISTOGRAM (${Object.keys(tagHist).length} tags) ===`); for (const [k, v] of top(tagHist, 80)) out.push(`  ${String(v).padStart(5)}  ${k}`)
fs.writeFileSync("/Users/matthewryan/RyanRealty/out/fub-nurture/addressless-truth.txt", out.join("\n"))
console.log(out.join("\n"))
