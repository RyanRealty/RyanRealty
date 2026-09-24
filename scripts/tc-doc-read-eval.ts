/**
 * Document reader evaluation: run the reader over labelled production
 * documents with one or more models and score each against the labels.
 *
 *   npx tsx scripts/tc-doc-read-eval.ts                       # default model, every labelled doc
 *   npx tsx scripts/tc-doc-read-eval.ts --models a,b          # compare models
 *   npx tsx scripts/tc-doc-read-eval.ts --dump <docId>...     # read unlabelled docs, print the reading
 *
 * Labels live in scripts/tc-doc-read-eval.labels.json, one entry per document:
 * what a person reading the PDF saw (form, per-party signature counts, the
 * response box). They carry no client names. Score = labelled facts the reader
 * got right; a wrong "signed" on any line is the failure that matters most and
 * is counted on its own.
 *
 * Read-only against production (downloads PDFs); spends reader tokens.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../lib/platform/env.mjs'

type Label = {
  docId: string
  note: string
  forms: Array<{
    profile: string
    signed: Record<string, number>
    unsigned: Record<string, number>
    response?: string
    instanceNumber?: string | null
  }>
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}

async function main() {
  await loadEnv()
  const { readDocumentBytes, readerModel } = await import('../lib/tc/doc-read/read-document')
  const { profileFor } = await import('../lib/tc/doc-read/profiles')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const models = (arg('--models') ?? readerModel()).split(',').map((s) => s.trim()).filter(Boolean)
  const dumpAt = process.argv.indexOf('--dump')
  const labels: Label[] =
    dumpAt >= 0
      ? process.argv.slice(dumpAt + 1).map((docId) => ({ docId, note: '(unlabelled)', forms: [] }))
      : JSON.parse(readFileSync('scripts/tc-doc-read-eval.labels.json', 'utf8'))

  mkdirSync('out/doc-read-eval', { recursive: true })
  const totals = new Map<string, { facts: number; right: number; falseSigned: number; missedSigned: number; cost: number; ms: number; docs: number }>()

  for (const label of labels) {
    const { data: doc } = await sb.from('tc_documents').select('id, name, storage_path').eq('id', label.docId).maybeSingle()
    if (!doc?.storage_path) {
      console.log(`skip ${label.docId}: no file`)
      continue
    }
    const { data: blob } = await sb.storage.from('tc-documents').download(String(doc.storage_path))
    if (!blob) continue
    const bytes = new Uint8Array(await blob.arrayBuffer())
    console.log(`\n=== ${doc.name} (${label.docId.slice(0, 8)}) — ${label.note}`)
    for (const model of models) {
      const t = totals.get(model) ?? { facts: 0, right: 0, falseSigned: 0, missedSigned: 0, cost: 0, ms: 0, docs: 0 }
      let read
      try {
        read = await readDocumentBytes(bytes, { model })
      } catch (e) {
        console.log(`  ${model}: FAILED ${(e as Error).message.slice(0, 160)}`)
        continue
      }
      writeFileSync(`out/doc-read-eval/${label.docId.slice(0, 8)}.${model}.json`, JSON.stringify(read.reading, null, 1))
      t.cost += read.costUsd
      t.ms += read.passes.reduce((s, p) => s + p.ms, 0)
      t.docs += 1
      const summary = read.reading.forms.map((f) => {
        const match = profileFor({ title: f.title, formNumber: f.formNumber })
        const counts: Record<string, [number, number]> = {}
        for (const l of f.signatureLines) {
          const c = (counts[l.party] ??= [0, 0])
          c[l.signed ? 0 : 1] += 1
        }
        return { profile: match?.profile.key ?? `?${f.title}`, response: f.response, instance: f.instanceNumber, counts }
      })
      console.log(
        `  ${model}: $${read.costUsd.toFixed(4)} ${read.passes.map((p) => `${p.kind}:${p.pages.length}p/${p.ms}ms`).join(' ')}`,
      )
      for (const s of summary) {
        console.log(`    ${s.profile} resp=${s.response} inst=${s.instance ?? '-'} ${Object.entries(s.counts).map(([p, [y, n]]) => `${p}:${y}✓${n}✗`).join(' ')}`)
      }
      // Score against labels, form by form in order of profile.
      for (const lf of label.forms) {
        const got = summary.find((s) => s.profile === lf.profile)
        t.facts += 1
        if (got) t.right += 1
        for (const [party, n] of Object.entries(lf.signed)) {
          t.facts += 1
          const y = got?.counts[party]?.[0] ?? 0
          if (y === n) t.right += 1
          else if (y > n) t.falseSigned += y - n
          else t.missedSigned += n - y
        }
        for (const [party, n] of Object.entries(lf.unsigned)) {
          t.facts += 1
          if ((got?.counts[party]?.[1] ?? 0) === n) t.right += 1
        }
        if (lf.response) {
          t.facts += 1
          if (got?.response === lf.response) t.right += 1
        }
        if (lf.instanceNumber !== undefined) {
          t.facts += 1
          if ((got?.instance ?? null) === lf.instanceNumber) t.right += 1
        }
      }
      totals.set(model, t)
    }
  }
  console.log('\n=== totals')
  for (const [model, t] of totals) {
    console.log(
      `${model}: ${t.right}/${t.facts} facts right, ${t.falseSigned} signatures claimed that are not there, ${t.missedSigned} signatures missed, $${t.cost.toFixed(4)} over ${t.docs} docs ($${(t.cost / Math.max(1, t.docs)).toFixed(4)}/doc), ${(t.ms / Math.max(1, t.docs) / 1000).toFixed(1)}s/doc`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
