#!/usr/bin/env node
/**
 * check-cma-exemplar.mjs — seller CMA clone target cannot be Tumalo / Robin.
 *
 * Matt 2026-08-19: agents kept cloning public/cmas/cma-19496-tumalo-reservoir
 * because the producer SKILL named it canonical. The RPR Sunstone packet was
 * attached twice and ignored. This gate fails a commit that puts that clone
 * instruction back, or that drops the Sunstone contract.
 *
 * Usage: node scripts/check-cma-exemplar.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const CONTRACT = 'docs/plans/CMA_SUNSTONE_CONTRACT.md'
const PDF = 'docs/plans/cma-exemplars/56628-sunstone-rpr.pdf'
const SKILL = 'marketing_brain_skills/producers/cma/SKILL.md'
const SPINE = 'docs/plans/CMA_PRICE_OPINION_SPINE.md'
const REQUIREMENTS = 'docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md'

const fails = []

function read(path) {
  if (!existsSync(path)) {
    fails.push(`${path}: missing`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

for (const path of [CONTRACT, PDF, SKILL, SPINE, REQUIREMENTS]) {
  if (!existsSync(path)) fails.push(`${path}: missing — Sunstone contract / packet must stay on disk`)
}

const contract = read(CONTRACT)
const skill = read(SKILL)
const spine = read(SPINE)
const reqs = read(REQUIREMENTS)

if (contract) {
  for (const needle of [
    'docs/plans/cma-exemplars/56628-sunstone-rpr.pdf',
    'Do not clone',
    'list range',
    'recommended list',
    'PRICING_QUALITY_STOP',
    'Never cross US-97',
  ]) {
    if (!contract.includes(needle)) {
      fails.push(`${CONTRACT}: must keep "${needle}"`)
    }
  }
}

if (skill) {
  if (!skill.includes(CONTRACT)) {
    fails.push(`${SKILL}: must point at ${CONTRACT} as the client-document spec`)
  }
  const banned = [
    { re: /canonical exemplar for the current rules/i, label: 'canonical exemplar for the current rules' },
    { re: /structural reference for any new CMA/i, label: 'structural reference for any new CMA' },
    { re: /clone from the 21042 Robin exemplar/i, label: 'clone from the 21042 Robin exemplar' },
    { re: /Fold its DATA density/i, label: 'Fold its DATA density' },
    { re: /not RPR['’]s look/i, label: "not RPR's look" },
  ]
  for (const ban of banned) {
    if (ban.re.test(skill)) fails.push(`${SKILL}: banned clone instruction "${ban.label}"`)
  }
  if (/cma-19496-tumalo-reservoir/.test(skill) && /canonical exemplar/i.test(skill)) {
    fails.push(`${SKILL}: Tumalo HTML must not be named canonical exemplar`)
  }
}

if (spine && !spine.includes(CONTRACT)) {
  fails.push(`${SPINE}: must point at ${CONTRACT} so the spine cannot override Sunstone chapters`)
}

if (reqs) {
  const row = reqs.split('\n').find((l) => l.startsWith('| R-068 |'))
  if (!row) {
    fails.push(`${REQUIREMENTS}: R-068 row missing`)
  } else {
    if (!row.includes('CMA_SUNSTONE_CONTRACT')) {
      fails.push(`${REQUIREMENTS}: R-068 must cite CMA_SUNSTONE_CONTRACT`)
    }
    if (/\| VERIFIED \|/.test(row)) {
      fails.push(
        `${REQUIREMENTS}: R-068 must stay PARTIAL until a rebuilt PDF ticks the Sunstone chapters — do not stamp VERIFIED on "beats RPR"`,
      )
    }
  }
}

if (fails.length > 0) {
  console.error('CMA exemplar gate FAILED:\n')
  for (const f of fails) console.error(`  ✗ ${f}`)
  console.error('\nClient CMA follows docs/plans/CMA_SUNSTONE_CONTRACT.md. Do not clone Tumalo.')
  process.exit(1)
}

console.log('CMA exemplar OK — Sunstone contract is the client spec, Tumalo is not cloneable.')
