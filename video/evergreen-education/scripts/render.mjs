#!/usr/bin/env node
/**
 * render.mjs
 *
 * Orchestrator: composes EvergreenInput props from data/4-pillars.json, the
 * computed equity table, the Grok illustration paths, the optional Grok Video
 * overlays, the music selection, and the captionWords from synth-vo.mjs.
 *
 * Then invokes Remotion render.
 *
 * Outputs:
 *   out/4-pillars/4-pillars-render-props.json  — the props used for the render
 *   out/4-pillars/4-pillars.mp4                — the rendered video
 *
 * Run: node video/evergreen-education/scripts/render.mjs
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_DIR = resolve(ROOT, 'data')
const OUT_DIR = resolve(ROOT, 'out', '4-pillars')
const PUB_DIR = resolve(ROOT, 'public', '4-pillars')

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const config = JSON.parse(await readFile(resolve(DATA_DIR, '4-pillars.json'), 'utf8'))
  const equity = JSON.parse(await readFile(resolve(DATA_DIR, '4-pillars-equity-by-year.json'), 'utf8'))
  const captionWords = (await exists(resolve(OUT_DIR, 'captionWords.json')))
    ? JSON.parse(await readFile(resolve(OUT_DIR, 'captionWords.json'), 'utf8'))
    : []

  // Grok Video overlays — only present if scout passed AND Matt picked
  const cashFlowVideoPath = (await exists(resolve(PUB_DIR, 'beat-1-cash-flow.mp4')))
    ? '4-pillars/beat-1-cash-flow.mp4'
    : null
  const outroVideoPath = (await exists(resolve(PUB_DIR, 'beat-6-outro.mp4')))
    ? '4-pillars/beat-6-outro.mp4'
    : null

  // VO present?
  const voPath = (await exists(resolve(PUB_DIR, 'voiceover.mp3'))) ? '4-pillars/voiceover.mp3' : ''
  const musicPath = (await exists(resolve(PUB_DIR, 'music.mp3'))) ? '4-pillars/music.mp3' : undefined

  const props = {
    beatDurations: config.beatDurations,
    voPath,
    musicPath,
    captionWords,
    illustrations: {
      intro: '4-pillars/illustrations/beat-0-hero.png',
      cashFlow: '4-pillars/illustrations/beat-1-cash-flow.png',
      appreciation: '4-pillars/illustrations/beat-2-appreciation.png',
      loanPaydown: '4-pillars/illustrations/beat-3-loan-paydown.png',
      taxBenefits: '4-pillars/illustrations/beat-4-tax-benefits.png',
      outro: '4-pillars/illustrations/beat-6-outro.png',
    },
    videoOverlays: {
      cashFlow: cashFlowVideoPath,
      outro: outroVideoPath,
    },
    pillarParams: {
      cashFlow: { kind: 'cashFlow', cashFlowMonthly: config.inputs.monthlyCashFlow },
      appreciation: {
        kind: 'appreciation',
        ratePercent: Math.round(config.inputs.appreciationRate * 100),
        firstYearGain: Math.round(config.inputs.purchasePrice * config.inputs.appreciationRate),
      },
      loanPaydown: {
        kind: 'loanPaydown',
        initialLoan: config.inputs.loanAmount,
        year1Paydown: 3800, // round-number per script; real computed value documented in citations.json
      },
      taxBenefits: {
        kind: 'taxBenefits',
        depreciationYearly: config.inputs.depreciationYearly,
        taxBracket: Math.round(config.inputs.taxBracket * 100),
        taxSavingsYearly: config.inputs.taxSavingsYearly,
      },
    },
    equityBars: equity.bars,
  }

  const propsPath = resolve(OUT_DIR, '4-pillars-render-props.json')
  await writeFile(propsPath, JSON.stringify(props, null, 2))
  console.log(`✓ wrote ${propsPath}`)
  console.log(`  VO present: ${voPath ? 'yes' : 'NO (silent render)'}`)
  console.log(`  Music present: ${musicPath ? 'yes' : 'no'}`)
  console.log(`  Caption words: ${captionWords.length}`)
  console.log(`  Beat 1 video overlay: ${cashFlowVideoPath ?? 'no (deterministic still)'}`)
  console.log(`  Beat 6 video overlay: ${outroVideoPath ?? 'no (deterministic still)'}`)

  console.log(`\nKicking off Remotion render...`)
  const outMp4 = resolve(OUT_DIR, '4-pillars.mp4')
  await exec(
    'npx',
    [
      'remotion',
      'render',
      'src/index.ts',
      'EvergreenExplainer',
      outMp4,
      '--codec', 'h264',
      '--concurrency', '1',
      '--crf', '22',
      '--image-format=jpeg',
      '--jpeg-quality=92',
      `--props=${propsPath}`,
    ],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_NO_WARNINGS: '1' } }
  ).then(({ stdout, stderr }) => {
    console.log(stdout)
    if (stderr) console.error(stderr)
  }).catch((err) => {
    console.error(err.stdout ?? '')
    console.error(err.stderr ?? err.message)
    process.exit(1)
  })

  console.log(`\n✓ render complete: ${outMp4}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
