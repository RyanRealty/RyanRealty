// READ-ONLY exhaustive scan: pull the FULL unfiltered person object for addressless
// FUB contacts and look for a street address in ANY field — custom fields, notes,
// background, deal name, emails, every string. Reports which fields carry address
// patterns + dumps a few complete records so we can see the pattern.
import { config } from "dotenv"; config({ path: "/Users/matthewryan/RyanRealty/.env.local" })
import fs from "node:fs"
const AUTH = "Basic " + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ":").toString("base64")
const H = { Authorization: AUTH, Accept: "application/json", "X-System": "RyanRealtyAudit" }

// loose street-address detector: number + 1-5 words + suffix (or unit/no-suffix Bend rural)
const STREET = /\b\d{2,6}\s+(?:[NSEW]{1,2}\s+)?[A-Za-z0-9'.\-]+(?:\s+[A-Za-z0-9'.\-]+){0,4}\s+(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Blvd|Cir|Circle|Loop|Ter|Terrace|Pkwy|Hwy|Trl|Trail|Pt|Point|Run|Path|Market)\b/i

// is this contact "addressless" by our prior definition?
const addressless = p => {
  const addrs = Array.isArray(p.addresses) ? p.addresses : []
  return !addrs.some(a => (a.street || "").trim()) && !((p.customSellerPropertyAddress || "").trim())
}

const fieldHasAddr = {}      // fieldName -> count of addressless contacts with an addr pattern there
let total = 0, addrlessN = 0, anyHit = 0
const dumps = []
const NOTES_CACHE = []

let path = "https://api.followupboss.com/v1/people?limit=100&fields=allFields"
let pages = 0
while (path) {
  const r = await fetch(path, { headers: H }); if (!r.ok) { console.error("HTTP", r.status); break }
  const d = await r.json(); const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    total++
    if (!addressless(p)) continue
    addrlessN++
    let hitFields = []
    for (const [k, v] of Object.entries(p)) {
      if (k === "addresses" || k === "customSellerPropertyAddress") continue
      let text = ""
      if (typeof v === "string") text = v
      else if (Array.isArray(v)) text = JSON.stringify(v)
      else if (v && typeof v === "object") text = JSON.stringify(v)
      if (text && STREET.test(text)) { hitFields.push(k); fieldHasAddr[k] = (fieldHasAddr[k] || 0) + 1 }
    }
    if (hitFields.length) {
      anyHit++
      if (dumps.length < 15) {
        const ex = {}
        for (const f of hitFields) { const m = String(typeof p[f] === "string" ? p[f] : JSON.stringify(p[f])).match(STREET); ex[f] = m ? m[0] : "?" }
        dumps.push({ id: p.id, name: `${p.firstName||""} ${p.lastName||""}`.trim(), source: p.source, hitFields, samples: ex })
      }
    }
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${total} scanned, ${addrlessN} addressless, ${anyHit} with addr-in-some-field\n`)
}

const out = []
out.push(`TOTAL contacts: ${total}`)
out.push(`addressless (no addresses[].street, no SPA): ${addrlessN}`)
out.push(`  ...of those, an address pattern found in SOME other field: ${anyHit}`)
out.push(``)
out.push(`fields carrying an address pattern (among addressless), by count:`)
for (const [k, v] of Object.entries(fieldHasAddr).sort((a, b) => b[1] - a[1])) out.push(`  ${String(v).padStart(5)}  ${k}`)
out.push(``)
out.push(`=== sample records (field -> extracted address) ===`)
for (const x of dumps) {
  out.push(`id=${x.id} "${x.name}" src=${x.source}`)
  for (const f of x.hitFields) out.push(`    ${f}: ${x.samples[f]}`)
}
fs.writeFileSync("/Users/matthewryan/RyanRealty/out/fub-nurture/addressless-deep-scan.txt", out.join("\n"))
console.log(out.join("\n"))
