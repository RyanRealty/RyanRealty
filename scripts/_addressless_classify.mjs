// READ-ONLY: classify EVERY addressless FUB contact by what it actually is, using
// hard signals, so we know the real composition (realtor vs owner vs FSBO-in-name
// vs recoverable-elsewhere vs truly-nothing). No asking — verify.
import { config } from "dotenv"; config({ path: "/Users/matthewryan/RyanRealty/.env.local" })
import fs from "node:fs"
const AUTH = "Basic " + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ":").toString("base64")
const H = { Authorization: AUTH, Accept: "application/json", "X-System": "RyanRealtyAudit" }

const STREET = /\b\d{2,6}\s+(?:[NSEW]{1,2}\s+)?[A-Za-z0-9'.\-]+(?:\s+[A-Za-z0-9'.\-]+){0,4}\s+(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Blvd|Cir|Circle|Loop|Ter|Terrace|Pkwy|Hwy|Trl|Trail|Pt|Point|Run|Path)\b/i
const BROKERAGE = /(realty|real estate|sotheby|keller williams|kw |re\/max|remax|coldwell|windermere|cascade hasson|stellar|exp |compass|berkshire|hathaway|century 21|c21|john l\. scott|premiere prop|brokers|realtor|realtors|properties llc|home sale|the agency|engel|völkers|hasson sir| sir$|fathom|epique|redfin|opendoor|nexthome|crmls)/i

const addressless = p => {
  const addrs = Array.isArray(p.addresses) ? p.addresses : []
  return !addrs.some(a => (a.street || "").trim()) && !((p.customSellerPropertyAddress || "").trim())
}
const norm = s => String(s ?? "").trim()

let total = 0, addrlessN = 0
const buckets = {
  realtor_signal: 0,       // license# / brokerage org / Realtor tag / type
  fsbo_addr_in_name: 0,    // street pattern in name/firstName
  addr_in_background: 0,   // street in background (and not already counted)
  addr_other_field: 0,     // dealName/lastComm/social
  truly_nothing: 0,
}
const realtorBy = { license: 0, brokerageOrg: 0, realtorTag: 0 }
const examplesNothing = []
const examplesRealtorOwner = []   // realtor-flagged but ALSO has an owner-ish signal (edge)

let path = "https://api.followupboss.com/v1/people?limit=100&fields=allFields"
let pages = 0
while (path) {
  const r = await fetch(path, { headers: H }); if (!r.ok) { console.error("HTTP", r.status); break }
  const d = await r.json(); const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    total++
    if (!addressless(p)) continue
    addrlessN++

    const nm = `${norm(p.firstName)} ${norm(p.lastName)} ${norm(p.name)}`
    const bg = norm(p.background)
    const org = norm(p.customOrganization) || norm(p.customBrokerage)
    const tags = (p.tags || []).map(t => String(t).toLowerCase())
    const hasLicense = !!norm(p.customRealtorLicense) || !!norm(p.customRealtorLicenseType)
    const brokerageOrg = (org && BROKERAGE.test(org)) || /^organization:\s*.+/i.test(bg) && BROKERAGE.test(bg)
    const realtorTag = tags.includes("realtor") || tags.includes("realtors") || tags.some(t => t.includes("broker-recruit") || t.includes("agent"))
    const isRealtor = hasLicense || brokerageOrg || realtorTag

    const fsboNameAddr = STREET.test(nm)
    const bgAddr = STREET.test(bg)

    // priority: realtor classification wins (they aren't owners) UNLESS the name is literally an address (FSBO)
    if (fsboNameAddr) { buckets.fsbo_addr_in_name++ }
    else if (isRealtor) {
      buckets.realtor_signal++
      if (hasLicense) realtorBy.license++
      else if (brokerageOrg) realtorBy.brokerageOrg++
      else realtorBy.realtorTag++
    }
    else if (bgAddr) { buckets.addr_in_background++ }
    else if (STREET.test(norm(p.dealName)) || STREET.test(norm(p.lastCommunication)) || STREET.test(JSON.stringify(p.socialData || ""))) { buckets.addr_other_field++ }
    else {
      buckets.truly_nothing++
      if (examplesNothing.length < 20) examplesNothing.push({ id: p.id, name: nm.trim(), src: p.source, type: p.type, org: org || "-", bg: bg.slice(0, 60), tags: (p.tags||[]).slice(0,5) })
    }
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${total} scanned\n`)
}

const out = []
out.push(`TOTAL contacts: ${total}`)
out.push(`ADDRESSLESS: ${addrlessN}`)
out.push(``)
out.push(`Classification of the ${addrlessN} addressless:`)
out.push(`  realtor/agent (license, brokerage org, or realtor tag):  ${buckets.realtor_signal}`)
out.push(`     by license#: ${realtorBy.license} | by brokerage org: ${realtorBy.brokerageOrg} | by tag: ${realtorBy.realtorTag}`)
out.push(`  FSBO w/ address IN NAME field (recoverable):             ${buckets.fsbo_addr_in_name}`)
out.push(`  address in background (recoverable):                     ${buckets.addr_in_background}`)
out.push(`  address in other field (dealName/lastComm/social):       ${buckets.addr_other_field}`)
out.push(`  TRULY NOTHING (no addr signal, not a realtor):           ${buckets.truly_nothing}`)
out.push(``)
out.push(`=== 20 "truly nothing" examples (what are they?) ===`)
for (const e of examplesNothing) out.push(`  id=${e.id} "${e.name}" src=${e.src} type=${e.type} org=${e.org} tags=${JSON.stringify(e.tags)}`)
fs.writeFileSync("/Users/matthewryan/RyanRealty/out/fub-nurture/addressless-classify.txt", out.join("\n"))
console.log(out.join("\n"))
