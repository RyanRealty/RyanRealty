/**
 * SkySlope → Vault daily intake, by hand. The daily run is the cron
 * /api/cron/skyslope-vault-intake; this is the same pass with a plan mode.
 * Rules: docs/TC_SYSTEM.md "SkySlope → Vault daily intake" ·
 * lib/tc/skyslope-intake.ts (decisions) · lib/data/tc/skyslope-intake.ts (I/O).
 *
 *   npx tsx scripts/tc-skyslope-intake.ts plan [--only <address text>] [--verbose]
 *       DRY RUN. Reads every SkySlope folder and the Vault, prints per property
 *       what the intake would add (deals, cycles, documents, checklist items,
 *       assignments, contacts), which fields it would update, and which Vault
 *       edits it would keep (drift). Writes nothing.
 *
 *   npx tsx scripts/tc-skyslope-intake.ts apply [--only <address text>] [--verbose]
 *       Same pass, written. Adds only; never overwrites a Vault edit. Every
 *       write appends a tc_events row with actor 'skyslope-intake'. No
 *       deadline: a first catch-up run can take as long as the downloads take.
 *
 * TC_SKYSLOPE_INTAKE_ENABLED=false (the cutover switch) makes apply refuse;
 * plan still runs so the state can be read after cutover.
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i > 0 ? (process.argv[i + 1] ?? null) : null
}
const has = (name: string) => process.argv.includes(name)

function fmt(v: unknown): string {
  if (v == null || v === '') return '∅'
  if (Array.isArray(v)) return `[${v.join(', ')}]`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'plan' && mode !== 'apply') {
    console.error('usage: npx tsx scripts/tc-skyslope-intake.ts plan|apply [--only <address text>] [--verbose]')
    process.exit(2)
  }
  const only = arg('--only')
  const verbose = has('--verbose')
  const { runSkySlopeVaultIntake } = await import('@/lib/data/tc/skyslope-intake')
  const { skySlopeIntakeEnabled } = await import('@/lib/tc/skyslope-intake')
  if (!skySlopeIntakeEnabled()) {
    console.log('TC_SKYSLOPE_INTAKE_ENABLED is off (cut over from SkySlope).' + (mode === 'apply' ? ' apply refused.' : ' plan runs read-only.'))
    if (mode === 'apply') process.exit(0)
  }

  console.log(`SkySlope → Vault intake · ${mode === 'plan' ? 'PLAN (dry run, writes nothing)' : 'APPLY'}${only ? ` · only "${only}"` : ''}`)
  const res = await runSkySlopeVaultIntake({ apply: mode === 'apply', only, deadline: null })
  if (!res.ok) {
    console.error(`\nFAILED: ${res.error ?? 'unknown error'}${res.blocker ? `\n${res.blocker}` : ''}`)
    process.exit(1)
  }

  console.log(`SkySlope folders: ${res.folders.sales} sale + ${res.folders.listings} listing · properties ${res.propertiesVisited}/${res.propertiesTotal} visited${res.complete ? '' : ' (stopped early)'}\n`)
  if (!res.properties.length) console.log('Nothing to add or update: the Vault already holds everything SkySlope shows.')
  for (const p of res.properties) {
    const deal =
      p.deal?.kind === 'existing'
        ? `deal ${p.deal.dealId.slice(0, 8)} "${p.deal.address}" (matched by ${p.deal.method})`
        : p.deal?.kind === 'create'
          ? `NEW DEAL ${p.deal.propertyKey}${p.deal.dealId ? ` → ${p.deal.dealId.slice(0, 8)}` : ''}`
          : p.deal?.kind === 'ambiguous'
            ? `AMBIGUOUS: ${p.deal.dealIds.map((d) => d.slice(0, 8)).join(', ')}`
            : 'no deal'
    console.log(`▸ ${p.address}  [${deal}]`)
    for (const c of p.cycles) {
      console.log(`    ${c.line}`)
      if (!verbose) continue
      for (const d of c.plan.documentsToAdd) console.log(`        + doc ${d.docId.slice(0, 8)} ${d.fileName}${d.archived ? ' (ARCHIVE)' : ''} · uploaded ${d.uploadDate ?? '?'}`)
      for (const a of c.plan.itemsToAdd) console.log(`        + item ${a.activityId} ${a.name} [${a.status}]`)
      for (const k of c.plan.contactsToAdd) console.log(`        + contact ${k.role}: ${[k.name, k.company, k.email].filter(Boolean).join(' · ')}`)
      for (const n of c.plan.archivedInSkySlopeOnly) console.log(`        = archived in SkySlope only, Vault copy left live: ${n}`)
    }
    for (const s of p.stages) {
      const d = s.decision
      if (d.kind === 'create') console.log(`    stage: ${d.stage} "${d.stageDetail}" (new deal)`)
      else if (d.kind === 'update') console.log(`    stage: ${d.from.stage} "${d.from.stageDetail}" → ${d.to.stage} "${d.to.stageDetail}"`)
      else if (d.kind === 'drift')
        console.log(`    stage KEPT (Vault edit): vault ${d.vault.stage} "${d.vault.stageDetail}" · SkySlope ${fmt(d.skyslopeBefore?.stageDetail)} → "${d.skyslopeNow.stageDetail}"`)
    }
    for (const e of p.errors) console.log(`    ERROR ${e}`)
    for (const f of p.documentFailures) console.log(`    DOC FAILED ${f.guid.slice(0, 8)}/${f.docId.slice(0, 8)} ${f.name}: ${f.error}`)
  }

  const t = res.totals
  if (mode === 'plan') {
    let docs = 0
    let items = 0
    let asg = 0
    let contacts = 0
    let fields = 0
    let drift = 0
    let adds = 0
    let deals = 0
    let statuses = 0
    let raws = 0
    let stages = 0
    for (const p of res.properties) {
      if (p.deal?.kind === 'create') deals++
      stages += p.stages.filter((x) => x.decision.kind === 'update').length
      for (const c of p.cycles) {
        if (c.plan.mode === 'add') adds++
        if (c.plan.rawChanged) raws++
        docs += c.plan.documentsToAdd.length
        items += c.plan.itemsToAdd.length
        statuses += c.plan.itemStatusUpdates.length
        asg += c.plan.assignmentsToAdd.length
        contacts += c.plan.contactsToAdd.length
        fields += c.plan.fieldUpdates.length
        drift += c.plan.drift.length + c.plan.itemStatusDrift.length
      }
    }
    console.log(
      `\nPLAN TOTALS: ${deals} new deal(s) · ${adds} new cycle(s) · ${fields} field update(s) · ${stages} stage update(s) · ${drift} drift kept · ${docs} document(s) · ${items} checklist item(s) · ${statuses} checklist status(es) · ${asg} assignment(s) · ${contacts} contact(s) · ${raws} raw payload(s) refreshed. Nothing was written.`,
    )
  } else {
    console.log(
      `\nAPPLIED: ${t.dealsAdded} deal(s) · ${t.cyclesAdded} cycle(s) added · ${t.cyclesUpdated} cycle(s) updated (${t.fieldsUpdated} fields) · ${t.driftKept} drift kept · ${t.rawRefreshed} raw refreshed · ${t.documentsAdded} document(s) (${t.documentFailures} failed) · ${t.itemsAdded} item(s) · ${t.itemStatusesUpdated} checklist status(es) · ${t.assignmentsAdded} assignment(s) · ${t.contactsAdded} contact(s) · ${t.stagesUpdated} stage(s) · ${t.events} tc_events row(s) · ${(res.ms / 1000).toFixed(1)}s`,
    )
  }
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
