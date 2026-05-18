#!/usr/bin/env node
/**
 * Offline validation harness for skyslope-forms-rename-documents-v2.
 *
 * Replays every from->to suggestion from a v1 dry-run JSONL through the v2
 * taxonomy and prints histograms + before/after samples without touching
 * SkySlope. Used to iterate the form-name + OREF# extractors fast.
 *
 *   node scripts/skyslope-forms-rename-v2-offline-test.mjs <dry-run.jsonl>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  CATEGORIES_WITHOUT_SALE_NUMBER,
  deriveFormName,
  extractOrefNumber,
  suggestStandardNameV2,
} from './skyslope-forms-document-taxonomy-v2.mjs'
import { inferKind, parseDate } from './skyslope-forms-document-taxonomy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function asV2FromV1(line) {
  const j = JSON.parse(line)
  const cat = inferKind(j.from, '')
  const oref = extractOrefNumber(j.from)
  const formName = deriveFormName(j.from, oref, cat)
  const useSale = !CATEGORIES_WITHOUT_SALE_NUMBER.has(cat)
  // v1 'to' has form __MLS-{NUM}__ so we can extract MLS from it.
  const mlsMatch = j.to.match(/__MLS-(\d+)__/)
  const sale = useSale && mlsMatch ? mlsMatch[1] : ''
  // v1 'to' has __SEQ__ at index 5 from the right of __orig...
  const seqMatch = j.to.match(/__(\d{3})__/)
  const seq = seqMatch ? Number(seqMatch[1]) : 0
  // v1 'to' starts with date.
  const dateMatch = j.to.match(/^(\d{4}-\d{2}-\d{2})/)
  const date = dateMatch ? dateMatch[1] : ''
  const newName = suggestStandardNameV2({
    date,
    seq,
    executed: false,
    saleNumber: sale,
    orefNumber: oref,
    formName,
  })
  return { from: j.from, to: newName, category: cat, oref, sale, formName }
}

const arg = process.argv[2] || path.join(ROOT, 'tmp/skyslope-2026-05-16/dry-run-rename.jsonl')
const lines = fs.readFileSync(arg, 'utf8').split('\n').filter(Boolean)

const orefHist = new Map()
const noOref = []
const sampleByCat = new Map()
for (const line of lines) {
  const r = asV2FromV1(line)
  if (r.oref) orefHist.set(r.oref, (orefHist.get(r.oref) || 0) + 1)
  else noOref.push(r)
  if (!sampleByCat.has(r.category)) sampleByCat.set(r.category, [])
  if (sampleByCat.get(r.category).length < 3) sampleByCat.get(r.category).push(r)
}

console.log(`Replayed ${lines.length} renames from ${arg}\n`)

console.log('=== OREF histogram (extracted) ===')
const sorted = [...orefHist.entries()].sort((a, b) => b[1] - a[1])
for (const [k, v] of sorted) console.log(String(v).padStart(4), k)

console.log(`\n=== ${noOref.length} renames with NO OREF# extracted ===`)
const noOrefByName = new Map()
for (const r of noOref) noOrefByName.set(r.formName, (noOrefByName.get(r.formName) || 0) + 1)
for (const [k, v] of [...noOrefByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(String(v).padStart(4), k)
}

console.log('\n=== samples per category (up to 3) ===')
for (const [cat, samples] of [...sampleByCat.entries()].sort()) {
  console.log(`\n[${cat}]`)
  for (const s of samples) {
    console.log(`  from: ${s.from}`)
    console.log(`  to:   ${s.to}`)
  }
}
