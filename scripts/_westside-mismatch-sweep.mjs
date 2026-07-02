#!/usr/bin/env node
/**
 * WESTSIDE IMPORT DATA-QUALITY SWEEP — READ-ONLY (2026-07-02)
 *
 * The 2026-05-27 westside CSV import update-matched ~2,880 pre-existing CRM
 * contacts and stamped county deed-owner parcel data onto them (address, APN,
 * valuation, equity/tenure tags, seller scores, broker-brief Background).
 * The Hoffman case (#13014) proved the skip-trace can attach a parcel to the
 * WRONG household. This sweep finds every other likely mis-match and emits a
 * reviewable flag list for Matt. NOTHING is mutated.
 *
 * Detectors (validated against the known cases before output is trusted):
 *   A. geography conflict — "owner:occupied" stamp vs out-of-Oregon phone
 *      area codes and/or a pre-existing non-Property address outside Oregon.
 *   B. name conflict — family email local-part (contains the stamped surname)
 *      carries a DIFFERENT first name than the stamped deed-owner first name.
 * Smoke tests: reconstructed pre-repair Hoffman MUST flag on both detectors;
 * live Steve Olivieri #5694 MUST NOT flag (his parcel is genuinely his).
 *
 * DIAL verification (authoritative owner-of-record, Deschutes ArcGIS taxlot
 * layer, per feedback_gis_authoritative_only.md): top flags only (--dial-cap,
 * default 200), 300 ms between requests.
 *
 * Outputs:
 *   out/westside-sweep/population.json      (cached extraction)
 *   out/westside-mismatch-flags.csv         (the flag list for Matt)
 *   out/westside-sweep/summary.json
 *
 * Usage: node scripts/_westside-mismatch-sweep.mjs [--skip-extract] [--dial-cap 200] [--no-dial]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const args = process.argv.slice(2)
const SKIP_EXTRACT = args.includes('--skip-extract')
const NO_DIAL = args.includes('--no-dial')
const capIdx = args.indexOf('--dial-cap')
const DIAL_CAP = capIdx > -1 ? Number(args[capIdx + 1]) : 200

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const OUT_DIR = 'out/westside-sweep'
const POP_PATH = `${OUT_DIR}/population.json`
const CSV_PATH = 'out/westside-mismatch-flags.csv'
const SUMMARY_PATH = `${OUT_DIR}/summary.json`
const CUTOFF = '2026-05-26' // import window start; created >= this = net-new county rows
const IMPORT_TAG = 'import:westside-2026-05'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- extraction
async function extract() {
  mkdirSync(OUT_DIR, { recursive: true })
  const people = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id,name,first_name,last_name,source,stage,tags,custom,phones,emails,addresses,background,fub_created_at')
      .contains('tags', [IMPORT_TAG])
      .eq('deleted', false)
      .lt('fub_created_at', CUTOFF)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error('crm_people page failed: ' + error.message)
    people.push(...data)
    process.stdout.write(`\r  people: ${people.length}`)
    if (data.length < PAGE) break
  }
  console.log()

  // pre-import engagement per person (two-way history = real relationship)
  const engagement = {}
  const ids = people.map((p) => p.id)
  const CHUNK = 150
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('crm_timeline')
      .select('person_id,kind')
      .in('person_id', chunk)
      .lt('ts', CUTOFF)
      .in('kind', ['sms_in', 'email_in', 'sms_out', 'note', 'web_event'])
      .limit(20000)
    if (error) throw new Error('crm_timeline chunk failed: ' + error.message)
    for (const row of data) {
      const e = (engagement[row.person_id] ||= { inbound: 0, sms_out: 0, notes: 0, web: 0 })
      if (row.kind === 'sms_in' || row.kind === 'email_in') e.inbound += 1
      else if (row.kind === 'sms_out') e.sms_out += 1
      else if (row.kind === 'note') e.notes += 1
      else e.web += 1
    }
    process.stdout.write(`\r  engagement chunks: ${Math.min(i + CHUNK, ids.length)}/${ids.length}`)
  }
  console.log()
  for (const p of people) p._eng = engagement[p.id] || { inbound: 0, sms_out: 0, notes: 0, web: 0 }
  writeFileSync(POP_PATH, JSON.stringify(people))
  return people
}

// ---------------------------------------------------------------- detectors
const OR_AREA_CODES = new Set(['541', '458', '503', '971'])
const NICKNAMES = {
  william: ['bill', 'billy', 'will', 'willy', 'liam'], robert: ['bob', 'bobby', 'rob', 'robby', 'bert'],
  richard: ['rick', 'ricky', 'rich', 'dick'], james: ['jim', 'jimmy', 'jamie'], john: ['jack', 'johnny', 'jon'],
  jonathan: ['jon', 'jonny', 'nathan'], michael: ['mike', 'mikey', 'mick'], david: ['dave', 'davey'],
  christopher: ['chris', 'topher', 'kit'], daniel: ['dan', 'danny'], matthew: ['matt', 'matty'],
  anthony: ['tony'], donald: ['don', 'donny'], steven: ['steve', 'stevie'], stephen: ['steve', 'stevie'],
  edward: ['ed', 'eddie', 'ted', 'ned'], thomas: ['tom', 'tommy'], joseph: ['joe', 'joey'],
  charles: ['charlie', 'chuck', 'chas'], kenneth: ['ken', 'kenny'], ronald: ['ron', 'ronny'],
  timothy: ['tim', 'timmy'], gerald: ['jerry', 'gerry'], lawrence: ['larry'], jeffrey: ['jeff'],
  gregory: ['greg'], raymond: ['ray'], samuel: ['sam', 'sammy'], benjamin: ['ben', 'benny'],
  andrew: ['andy', 'drew'], nicholas: ['nick', 'nicky'], patrick: ['pat', 'paddy'], alexander: ['alex', 'al'],
  frederick: ['fred', 'freddy'], theodore: ['ted', 'teddy', 'theo'], leonard: ['len', 'lenny', 'leo'],
  albert: ['al', 'bert'], eugene: ['gene'], douglas: ['doug'], harold: ['harry', 'hal'], walter: ['walt', 'wally'],
  arthur: ['art', 'artie'], peter: ['pete'], zachary: ['zach', 'zack'], joshua: ['josh'], gary: ['gare'],
  jacob: ['jake'], nathaniel: ['nate', 'nathan'], vincent: ['vince', 'vinny'], bradley: ['brad'],
  randall: ['randy'], randolph: ['randy'], russell: ['russ'], stanley: ['stan'], norman: ['norm'],
  herbert: ['herb'], bernard: ['bernie'], calvin: ['cal'], curtis: ['curt'], dennis: ['denny'],
  ernest: ['ernie'], howard: ['howie'], jerome: ['jerry'], louis: ['lou', 'louie'], marcus: ['marc', 'mark'],
  martin: ['marty'], maurice: ['mo'], melvin: ['mel'], mitchell: ['mitch'], phillip: ['phil'], philip: ['phil'],
  sidney: ['sid'], terrence: ['terry'], vernon: ['vern'], wesley: ['wes'],
  elizabeth: ['liz', 'lizzy', 'beth', 'betsy', 'betty', 'eliza', 'libby'], margaret: ['maggie', 'meg', 'peggy', 'marge', 'margo'],
  katherine: ['kate', 'katie', 'kathy', 'kat', 'kitty'], catherine: ['cathy', 'kate', 'katie', 'cat'],
  kathleen: ['kathy', 'kate', 'katie'], jennifer: ['jen', 'jenny'], jessica: ['jess', 'jessie'],
  patricia: ['pat', 'patty', 'tricia', 'trish'], barbara: ['barb', 'barbie'], susan: ['sue', 'susie', 'suzy'],
  suzanne: ['sue', 'susie', 'suzy'], deborah: ['deb', 'debbie', 'debra'], debra: ['deb', 'debbie'],
  cynthia: ['cindy'], sandra: ['sandy'], pamela: ['pam'], rebecca: ['becky', 'becca'], victoria: ['vicky', 'tori'],
  christina: ['chris', 'christy', 'tina'], christine: ['chris', 'christy', 'chrissy'], stephanie: ['steph'],
  michelle: ['shelly'], kimberly: ['kim'], amanda: ['mandy'], melissa: ['mel', 'missy'], laura: ['laurie'],
  lauren: ['laurie'], nancy: ['nan'], carolyn: ['carol', 'carrie'], caroline: ['carol', 'carrie'],
  dorothy: ['dot', 'dotty', 'dee'], judith: ['judy'], janet: ['jan'], janice: ['jan'], virginia: ['ginny', 'ginger'],
  florence: ['flo'], eleanor: ['ellie', 'nora'], frances: ['fran', 'franny'], francis: ['fran', 'frank'],
  gwendolyn: ['gwen'], jacqueline: ['jackie'], josephine: ['jo', 'josie'], veronica: ['ronnie'],
  alexandra: ['alex', 'lexi', 'sandra'], samantha: ['sam'], danielle: ['dani'], natalie: ['nat'],
  abigail: ['abby'], gabrielle: ['gabby'], isabella: ['bella', 'izzy'], vanessa: ['nessa'],
  angela: ['angie'], bonnie: [], connie: [], constance: ['connie'], teresa: ['terry', 'tess'],
  theresa: ['terry', 'tess'], sharon: ['shari'], cheryl: ['sherry'], donna: [], diane: ['di'], diana: ['di'],
  ronda: [], rhonda: [], linda: ['lin', 'lindy'], brenda: [], glenda: [], wanda: [], sondra: ['sandy'],
}
function nameVariants(first) {
  const f = first.toLowerCase().replace(/[^a-z]/g, '')
  const out = new Set([f])
  if (NICKNAMES[f]) for (const n of NICKNAMES[f]) out.add(n)
  for (const [formal, nicks] of Object.entries(NICKNAMES)) if (nicks.includes(f)) { out.add(formal); for (const n of nicks) out.add(n) }
  return out
}
function firstNameCandidates(firstRaw) {
  // deed first fields can hold "Kevin & Maria" / "Kevin L" — split into tokens
  return String(firstRaw || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3 && t !== 'and')
}

function detect(p) {
  const tags = p.tags || []
  const occupied = tags.includes('owner:occupied')
  const tenureLong = tags.some((t) => ['tenure:13-17yr', 'tenure:18-24yr', 'tenure:25plus'].includes(t))
  const signals = []
  const evidence = []

  // A1 — phones: ALL area codes outside Oregon while stamped owner-occupied
  const areaCodes = []
  for (const ph of p.phones || []) {
    const digits = String(ph.normalized || ph.value || '').replace(/\D/g, '')
    const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    if (ten.length === 10) areaCodes.push(ten.slice(0, 3))
  }
  const phoneOut = areaCodes.length > 0 && areaCodes.every((ac) => !OR_AREA_CODES.has(ac))
  if (phoneOut && occupied) {
    signals.push('phone-out-of-state+occupied')
    evidence.push(`all phone area codes non-OR (${[...new Set(areaCodes)].join(',')}) vs owner-occupied stamp`)
  }

  // A2 — pre-existing non-Property address outside Oregon while owner-occupied
  const outAddrs = (p.addresses || []).filter(
    (a) => String(a.type || '').toLowerCase() !== 'property' && a.state && String(a.state).toUpperCase() !== 'OR'
  )
  const addrOut = outAddrs.length > 0
  if (addrOut && occupied) {
    signals.push('address-out-of-state+occupied')
    evidence.push(`non-Property address outside OR: ${outAddrs.map((a) => `${a.street || ''} ${a.city || ''} ${a.state}`.trim()).join(' | ')}`)
  }

  // B — family email local-part carries a different first name than the deed stamp
  const firsts = firstNameCandidates(p.first_name)
  const last = String(p.last_name || '').toLowerCase().replace(/[^a-z]/g, '')
  let altFirst = null
  if (last.length >= 4 && firsts.length) {
    for (const em of p.emails || []) {
      const lp = String(em.value || '').split('@')[0].toLowerCase().replace(/[^a-z]/g, '')
      if (!lp.includes(last)) continue
      const remainder = lp.replace(new RegExp(last, 'g'), '')
      if (remainder.length < 3) continue
      if (!/[aeiouy]/.test(remainder)) continue // initials-only local-parts (dds, mlg, rnr) are not names
      const fullNameTokens = String(p.name || '').toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 3)
      if (fullNameTokens.some((t) => remainder.includes(t) || t.includes(remainder))) continue // middle-name match
      // match forms: raw, and minus a trailing middle-initial letter ("hilaryj" → "hilary")
      const remForms = [remainder]
      if (remainder.length >= 5) remForms.push(remainder.slice(0, -1))
      const matchesStamp = firsts.some((f) => {
        for (const v of nameVariants(f)) for (const rf of remForms) if (rf.includes(v) || (v.length >= 3 && v.includes(rf))) return true
        return false
      })
      if (!matchesStamp) {
        altFirst = remainder
        signals.push('email-name-conflict')
        evidence.push(`email ${em.value} local-part reads "${remainder}" ≠ stamped first name "${p.first_name}"`)
        break
      }
    }
  }

  // confidence
  let confidence = null
  if (altFirst && (phoneOut || addrOut) && occupied) confidence = 'high' // the Hoffman signature
  else if (altFirst && (phoneOut || addrOut)) confidence = 'high' // name conflict + geo conflict on absentee stamp
  else if (altFirst) confidence = 'medium'
  else if (occupied && phoneOut && addrOut) confidence = 'medium'
  else if (occupied && phoneOut && tenureLong) confidence = 'medium'
  else if (occupied && (phoneOut || addrOut)) confidence = 'low'

  return { signals, evidence, confidence, altFirst, areaCodes: [...new Set(areaCodes)], occupied, tenureLong }
}

// ---------------------------------------------------------------- DIAL
const DIAL_URL = 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query'
async function dialByApn(apn) {
  const params = new URLSearchParams({
    where: `dbo_GIS_MAILING.ACCOUNT_ID='${String(apn).replace(/[^0-9A-Za-z]/g, '')}'`,
    outFields:
      'dbo_GIS_MAILING.OWNER,dbo_GIS_MAILING.IN_CARE_OF,dbo_GIS_MAILING.M_ADDRESS,dbo_GIS_MAILING.M_CITY,dbo_GIS_MAILING.M_STATE,Taxlot_Assessor_Account.Address,Taxlot_Assessor_Account.City',
    returnGeometry: 'false',
    f: 'json',
  })
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const r = await fetch(`${DIAL_URL}?${params}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const j = await r.json()
      if (j.error) throw new Error('arcgis error ' + JSON.stringify(j.error))
      const a = j.features?.[0]?.attributes
      if (!a) return null
      return {
        owner: a['dbo_GIS_MAILING.OWNER'] || '',
        inCareOf: a['dbo_GIS_MAILING.IN_CARE_OF'] || '',
        mailing: [a['dbo_GIS_MAILING.M_ADDRESS'], a['dbo_GIS_MAILING.M_CITY'], a['dbo_GIS_MAILING.M_STATE']].filter(Boolean).join(', '),
        mState: a['dbo_GIS_MAILING.M_STATE'] || '',
        situs: [a['Taxlot_Assessor_Account.Address'], a['Taxlot_Assessor_Account.City']].filter(Boolean).join(', '),
      }
    } catch (e) {
      if (attempt === 3) return { error: e.message }
      await sleep(700 * attempt)
    }
  }
}
function fuzzyTokenMatch(nameToken, ownerString) {
  // deed surnames drift ("OLIVIER" vs "Olivieri") — prefix match at ≥5 chars
  const t = nameToken.toLowerCase().replace(/[^a-z]/g, '')
  if (!t) return false
  const tokens = ownerString.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  return tokens.some((o) => o === t || (Math.min(o.length, t.length) >= 5 && (o.startsWith(t) || t.startsWith(o))))
}

// ---------------------------------------------------------------- smoke tests
function smokeTest(population) {
  // 1. Reconstructed PRE-REPAIR Hoffman #13014 (from mission PROGRESS + Change Log:
  //    deed stamp "Kevin Hoffman", owner-occupied long-tenure westside parcel,
  //    619 San Diego phones, Maria's mariahoffman1@aol.com on the record)
  const hoffmanPre = {
    id: 'SMOKE-HOFFMAN-PRE-REPAIR',
    first_name: 'Kevin', last_name: 'Hoffman',
    phones: [{ value: '(619) 279-2245' }, { value: '(619) 890-6959' }],
    emails: [{ value: 'mariahoffman1@aol.com' }],
    addresses: [],
    tags: ['import:westside-2026-05', 'owner:occupied', 'tenure:25plus', 'area:bend-westside'],
  }
  const h = detect(hoffmanPre)
  const hoffmanOk =
    h.confidence === 'high' && h.signals.includes('email-name-conflict') && h.signals.includes('phone-out-of-state+occupied') && h.altFirst === 'maria'
  console.log(`SMOKE Hoffman pre-repair: confidence=${h.confidence} signals=[${h.signals}] alt=${h.altFirst} → ${hoffmanOk ? 'PASS' : 'FAIL'}`)

  // 2. Live Steve Olivieri #5694 — parcel genuinely his (Matt-confirmed) — must NOT flag
  const oliv = population.find((p) => p.id === 5694)
  if (!oliv) { console.log('SMOKE Olivieri: NOT IN POPULATION — FAIL'); return false }
  const o = detect(oliv)
  const olivOk = o.confidence === null && o.signals.length === 0
  console.log(`SMOKE Olivieri #5694: confidence=${o.confidence} signals=[${o.signals}] → ${olivOk ? 'PASS' : 'FAIL'}`)
  return hoffmanOk && olivOk
}

// ---------------------------------------------------------------- main
const SPLIT_AGENT_SURNAMES = new Set(['millard', 'westendorf', 'mcfeley', 'detweiler', 'hogge', 'timms', 'newton', 'fess', 'reese', 'king', 'karp', 'creekmore', 'robinson', 'plunkett', 'pohl', 'crawley', 'uchikawa'])

function csvEscape(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

async function main() {
  let population
  if (SKIP_EXTRACT && existsSync(POP_PATH)) {
    population = JSON.parse(readFileSync(POP_PATH, 'utf8'))
    console.log(`loaded cached population: ${population.length}`)
  } else {
    population = await extract()
    console.log(`extracted population: ${population.length}`)
  }

  if (!smokeTest(population)) {
    console.error('DETECTOR SMOKE TEST FAILED — refusing to produce output. Fix the detector first.')
    process.exit(1)
  }

  const flags = []
  const conf = { high: 0, medium: 0, low: 0 }
  for (const p of population) {
    const d = detect(p)
    if (!d.confidence) continue
    conf[d.confidence] += 1
    flags.push({ p, d })
  }
  const rank = { high: 0, medium: 1, low: 2 }
  flags.sort((a, b) => {
    if (rank[a.d.confidence] !== rank[b.d.confidence]) return rank[a.d.confidence] - rank[b.d.confidence]
    const ea = a.p._eng || {}, eb = b.p._eng || {}
    return (eb.inbound * 10 + eb.sms_out * 3 + eb.notes || 0) - (ea.inbound * 10 + ea.sms_out * 3 + ea.notes || 0)
  })
  console.log(`flags: ${flags.length}  (high ${conf.high} / medium ${conf.medium} / low ${conf.low})`)

  // DIAL verify top flags
  let dialCount = 0
  if (!NO_DIAL) {
    const toVerify = flags.filter((f) => f.d.confidence !== 'low').slice(0, DIAL_CAP)
    console.log(`DIAL-verifying ${toVerify.length} flags (cap ${DIAL_CAP})…`)
    for (const f of toVerify) {
      const apn = f.p.custom?.customAPN
      if (!apn) { f.dial = { verdict: 'no-apn' }; continue }
      const res = await dialByApn(apn)
      dialCount += 1
      await sleep(300)
      if (!res) { f.dial = { verdict: 'dial:no-result' }; continue }
      if (res.error) { f.dial = { verdict: 'dial:error ' + res.error }; continue }
      const lastMatch = fuzzyTokenMatch(f.p.last_name || '', res.owner)
      const firstMatch = firstNameCandidates(f.p.first_name).some((fn) => [...nameVariants(fn)].some((v) => fuzzyTokenMatch(v, res.owner)))
      const altMatch = f.d.altFirst ? [...nameVariants(f.d.altFirst)].some((v) => fuzzyTokenMatch(v, res.owner)) : false
      // contact's own non-Property address matching the DIAL mailing = the contact IS the owner
      const mailingMatchesContact = (f.p.addresses || []).some((a) => {
        const st = String(a.state || '').toUpperCase()
        const city = String(a.city || '').toLowerCase()
        return st && st === res.mState.toUpperCase() && city && res.mailing.toLowerCase().includes(city)
      })
      let verdict
      if (altMatch) verdict = 'false-positive: email identity IS on the deed'
      else if (mailingMatchesContact && !f.d.altFirst) verdict = 'likely fine: county mails the owner at this contact\'s own address'
      else if (!lastMatch) verdict = 'deed owner surname differs from stamped name (stamp/APN drift)'
      else if (lastMatch && firstMatch) verdict = 'deed matches STAMPED name only — contact identity unproven (Hoffman pattern)'
      else verdict = 'deed surname matches, first name does not'
      f.dial = { ...res, verdict }
      process.stdout.write(`\r  dial: ${dialCount}/${toVerify.length}`)
    }
    console.log()
  }

  // emit CSV
  const header = [
    'person_id', 'crm_url', 'name', 'source', 'stage', 'confidence', 'signals', 'evidence', 'alt_identity',
    'area_codes', 'owner_class', 'tenure_long', 'stamped_parcel', 'apn',
    'engagement_inbound', 'engagement_sms_out', 'engagement_notes',
    'dial_owner', 'dial_in_care_of', 'dial_mailing', 'dial_situs', 'dial_verdict',
    'recommended_action', 'split_agent_overlap',
  ]
  const lines = [header.join(',')]
  for (const f of flags) {
    const { p, d } = f
    const dial = f.dial || {}
    let action
    if (dial.verdict?.startsWith('false-positive') || dial.verdict?.startsWith('likely fine')) action = 'looks fine'
    else if (d.confidence === 'high') action = 'strip parcel data (Matt approve)'
    else if (d.confidence === 'medium') action = 'needs Matt'
    else action = 'needs Matt (low priority)'
    const e = p._eng || {}
    lines.push([
      p.id, `https://ryanrealty.vercel.app/admin/crm/${p.id}`, p.name, p.source, p.stage,
      d.confidence, d.signals.join(' | '), d.evidence.join(' | '), d.altFirst || '',
      d.areaCodes.join(' '), d.occupied ? 'occupied' : 'absentee', d.tenureLong ? 'yes' : '',
      p.custom?.customSellerPropertyAddress || '', p.custom?.customAPN || '',
      e.inbound || 0, e.sms_out || 0, e.notes || 0,
      dial.owner || '', dial.inCareOf || '', dial.mailing || '', dial.situs || '', dial.verdict || '',
      action, SPLIT_AGENT_SURNAMES.has(String(p.last_name || '').toLowerCase()) ? 'YES — sibling split agent may touch' : '',
    ].map(csvEscape).join(','))
  }
  writeFileSync(CSV_PATH, lines.join('\n') + '\n')

  const summary = {
    ranAt: new Date().toISOString(),
    population: population.length,
    flags: flags.length,
    byConfidence: conf,
    dialVerified: dialCount,
    dialVerdicts: Object.fromEntries(
      Object.entries(
        flags.reduce((acc, f) => { const v = f.dial?.verdict || '(not checked)'; acc[v] = (acc[v] || 0) + 1; return acc }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
    csv: CSV_PATH,
  }
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
