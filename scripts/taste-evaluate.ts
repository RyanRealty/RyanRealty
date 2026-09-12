/**
 * taste-evaluate.ts — the SEPARATE evaluator TASTE.md requires, as a command.
 *
 * "The builder never grades its own page. After the ritual, spawn an evaluator
 * (on a DIFFERENT model from the builder, with the desktop + 375px screenshots
 * and the rendered page's URL) with this rubric" — design_system/public/TASTE.md.
 *
 * WHY THIS FILE EXISTS. The evaluator has to be a different model looking at
 * the actual pixels. A lane running inside a harness with no subagent tool has
 * no other way to get a second pair of eyes onto the shots, and "the builder
 * scored itself" is the exact failure TASTE.md was written to end (Anthropic's
 * own harness work: agents "confidently praise their own work even when quality
 * is mediocre"). This routes the shots through lib/grok — the one surface any
 * model call in this repo is allowed to use (CLAUDE.md §4) — as
 * grok-4.6 through the grok CLI (see THE ONE INSTRUMENT below), which differs from a grok-4.5 builder
 * (`grok-4.6`). It prints the three scorings, their median, and the named
 * defects, in the shape the route's parity.json tasteReview wants.
 *
 * IT DOES NOT WRITE THE RECEIPT. The builder reads the findings, fixes them,
 * re-shoots, re-runs this, and writes the receipt by hand — because
 * `comparedToPrior` is a judgement about two instruments, not an output.
 *
 * Usage:
 *   npx tsx scripts/taste-evaluate.ts <route-key> [--shots a.png,b.png]
 *                                     [--url <rendered url>] [--beat <prior score>]
 *
 * Reads every PNG in design_system/ryan-realty/ui_kits/<route-key>/shots unless
 * --shots names files. Prints JSON on stdout.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config } from 'dotenv'
import { parseJsonLoose } from '../lib/grok/text'
import {
  classForRoute,
  evaluatorBrief,
  loadTasteCatalog,
  replaceWithOptionProblems,
} from './lib/taste-catalog.mjs'
import {
  evaluatorVoiceBrief,
  evaluateVoiceResult,
  visitorCopyFromHtml,
} from './lib/taste-voice.mjs'

/**
 * THE ONE INSTRUMENT (Matt 2026-09-09: "default to always having Grok 4.6 do the
 * evaluation preferably always using the subscription tokens").
 *
 * The judge is a property of the REPO, not of whoever is building: every page
 * class is scored by grok-4.6 whether a Claude lane, a Grok lane or the table
 * tool asks, so two marks are always comparable and `ci:taste-canon`'s rise rule
 * means one thing. Before this, a Claude lane scored with claude-sonnet-5 and a
 * Grok lane with grok-4.5, so every page a Grok lane touched rebaselined and its
 * old mark stopped counting.
 *
 * Transport is the `grok` CLI, not `xaiFetch`: the CLI spends Matt's Grok
 * subscription, the API path bills XAI_API_KEY per token. Verified 2026-09-09
 * that the CLI reads PNGs off disk and reports what is in them.
 *
 * The builder must differ (ci:taste-canon refuses evaluatorModel ==
 * builderModel), so a Grok lane BUILDS with grok-4.5 and is judged by 4.6.
 */
const EVALUATOR_MODEL = 'grok-4.6'
const GROK_CLI = process.env.GROK_CLI ?? `${process.env.HOME}/.grok/bin/grok`
/** SITE-63 bumped rubric — form prescription (`replaceWith`) is required. */
const RUBRIC_PATH = 'design_system/public/taste-evaluator.v1-2026-09-10.md'
const RUBRIC_VERSION = 'v1-2026-09-10'

config({ path: '.env.local' })

const UI_KITS = 'design_system/ryan-realty/ui_kits'

function loadRubric(): string {
  if (!existsSync(RUBRIC_PATH)) {
    throw new Error(`taste-evaluate: missing rubric at ${RUBRIC_PATH}`)
  }
  return readFileSync(RUBRIC_PATH, 'utf8').trim()
}

function parseArgs(argv: string[]) {
  const out: { routeKey?: string; shots?: string[]; url?: string; beat?: string; focus?: string } = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!
    if (a === '--shots') out.shots = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--url') out.url = argv[++i]
    else if (a === '--beat') out.beat = argv[++i]
    else if (a === '--focus') out.focus = argv[++i]
    else positional.push(a)
  }
  out.routeKey = positional[0]
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.routeKey) {
    console.error('usage: npx tsx scripts/taste-evaluate.ts <route-key> [--shots a.png,b.png] [--url ...] [--beat <score>] [--focus "..."]')
    process.exit(2)
  }
  const dir = join(UI_KITS, args.routeKey, 'shots')
  const files = (args.shots ?? readdirSync(dir).filter((f) => f.endsWith('.png')).sort()).map((f) =>
    f.includes('/') ? f : join(dir, f),
  )
  if (files.length === 0) {
    console.error(`no shots in ${dir}`)
    process.exit(2)
  }

  const images = files.map((f) => ({
    name: f.split('/').pop()!,
    path: resolve(f),
  }))

  let catalogNote = ''
  const catalogPath = 'design_system/public/taste-catalog.json'
  if (!existsSync(catalogPath)) {
    console.error('taste-evaluate: design_system/public/taste-catalog.json is missing — the lane has no Lego.')
    process.exit(2)
  }
  let loaded
  try {
    loaded = loadTasteCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')))
  } catch (err) {
    console.error(`taste-evaluate: catalog unreadable: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }
  if (loaded.problems.length) {
    console.error(`taste-evaluate: catalog problems:\n${loaded.problems.join('\n')}`)
    process.exit(2)
  }
  const classKey = classForRoute(loaded, args.routeKey) ?? args.routeKey
  catalogNote = evaluatorBrief(loaded, classKey)

  const bar =
    args.beat == null
      ? 'There is NO previous recorded mark for this page class. This is its first mark, so score it on its merits with no anchor.'
      : `The previous recorded mark for this page class is ${args.beat}. Do not anchor on it: score what you see. State plainly whether this is better or worse than a ${args.beat}/100 page and why.`

  const refPath = join('design_system/public/references', `${args.routeKey}.md`)
  const refNote = existsSync(refPath)
    ? `A class reference file exists at ${refPath}. Prefer naming \`beats\` against one of the pages listed there.`
    : ''

  let visitorCopy = ''
  if (args.url) {
    try {
      const res = await fetch(args.url, {
        headers: { 'user-agent': 'Mozilla/5.0 (TasteVoice/1.0; +https://ryan-realty.com)' },
      })
      if (res.ok) visitorCopy = visitorCopyFromHtml(await res.text())
    } catch {
      visitorCopy = ''
    }
  }

  const question = [
    loadRubric(),
    '',
    `Rubric version for the receipt: ${RUBRIC_VERSION}.`,
    `The shots, in order: ${images.map((i) => i.name).join(', ')}.`,
    'Names ending -desktop are 1440px wide; names ending -mobile375 are 375px wide.',
    args.url ? `The page is rendered at ${args.url}.` : '',
    args.focus ? `What changed in this pass: ${args.focus}` : '',
    catalogNote,
    evaluatorVoiceBrief({ visitorCopy }),
    refNote,
    bar,
    '',
    'Score the SAME shots THREE separate times, independently, as three different reviewers would. One pass is noise.',
    'Honesty is not a trade. The loop is comprehensive: SEO, listing/page information, and UX must all improve on this pass. A prettier fold that hides a sourced figure, drops JSON-LD, removes an ask, drops listing facts from a card, or makes a number unverifiable is a blocking defect. honestyFunction must not fall. Omitting honesty to skip the hold is a blocking defect. requiredComponents, JSON-LD, titles, conversion asks, tap targets, and page payload must not fall. Listing pages may not drop or summarize PropertySpecs, MLS remarks, schools, payment, or Tour/Call/Text. Name in the verdict whether SEO improved and whether inventory/information improved; if either is only "held," that is a defect.',
    'Voice is not a trade. Every page pass reads the words a visitor can read (VOICE.md). Quote them. A visually fine page that talks like an analyst briefing has failed. Omitting voice to skip the hold is a blocking defect.',
    'Diagnose each defect as a JOB, then set replaceWith from the catalog option list in the brief (id + demo URL). Do not pick a house primitive that already lost. A cream box that kept a catalog name is a taste defect. If the live control and the demo are not the same interaction, demoMatch is false. Shots named search-open / *-open are the demo-match record — judge whether the opened control matches the catalog demo, not only the rest fold. A V3 wrapper that imported the file then hid the morph, the card body, or the carousel is demoMatch false.',
    'Then list the named defects behind the number: each one names the section (a css class or an id you can see), the severity (blocking | taste | craft), a finding of at least ten characters, and replaceWith — a catalog id from the option list, a house form from the rubric list, or null if the finding is craft/honesty/SEO not form.',
    'Empty defects is only allowed above 95.',
    'Answer as JSON: {"scores":[n,n,n],"score":<median>,"perCriterion":{"design":n,"originality":n,"interaction":n,"craft":n,"honesty":n},"demoMatch":true|false,"voice":{"pass":true,"lines":["sentence one","sentence two"],"findings":[]},"beats":"<the competing page you would compare this to and the metric we win or lose>","defects":[{"section":"...","severity":"...","finding":"...","replaceWith":"<house form, primitive, catalog id, or null>"}],"verdict":"<two sentences>"}',
  ]
    .filter(Boolean)
    .join('\n')

  if (!existsSync(GROK_CLI)) {
    console.error(`taste-evaluate: no grok CLI at ${GROK_CLI}. Set GROK_CLI to its path.`)
    process.exit(2)
  }
  // The CLI is an agent: it is told to open the files rather than handed base64,
  // which is also why the shots must be absolute paths.
  const prompt = [
    'You are a design critic reviewing a page you did not build. You are hard to impress and you say why. You never praise a page for being clean; clean is the floor. You name what is dull. When the display is a banned data form, you name the house form that replaces it.',
    '',
    `Read these screenshot files with your file tool and judge what is IN them:`,
    ...images.map((i) => `  ${i.path}`),
    '',
    question,
    '',
    'Reply with the JSON object and nothing else — no preamble, no code fence.',
  ].join('\n')

  // Strip XAI_API_KEY so the grok CLI cannot fall back to console.x.ai pay-per-token.
  // dotenv loaded .env.local above; the CLI otherwise treats that key as API billing
  // when the grok.com session is missing (launchd). Subscription is ~/.grok/auth.json.
  const grokEnv = { ...process.env }
  delete grokEnv.XAI_API_KEY
  const res = spawnSync(
    GROK_CLI,
    ['-p', prompt, '-m', EVALUATOR_MODEL, '--permission-mode', 'bypassPermissions', '--output-format', 'plain'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000, env: grokEnv },
  )
  if (res.status !== 0) {
    console.error(`taste-evaluate: grok CLI exited ${res.status}: ${(res.stderr || '').trim().slice(0, 400)}`)
    process.exit(2)
  }
  const content = res.stdout ?? ''
  const parsed = parseJsonLoose(content)
  const defects =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { defects?: unknown }).defects)
      ? (parsed as { defects: Array<{ replaceWith?: unknown }> }).defects
      : []
  const missingReplace = defects.filter((d) => d && typeof d === 'object' && !('replaceWith' in d)).length
  if (missingReplace > 0) {
    console.error(
      `taste-evaluate: ${missingReplace} defect(s) missing replaceWith. The next catalog-class receipt will fail ci:taste-canon.`,
    )
    process.exit(2)
  }
  const optionProblems = replaceWithOptionProblems(loaded, classKey, { defects })
  if (optionProblems.length) {
    console.error(`taste-evaluate: replaceWith not on the option list:\n${optionProblems.join('\n')}`)
    process.exit(2)
  }
  const demoMatch =
    parsed && typeof parsed === 'object' ? (parsed as { demoMatch?: unknown }).demoMatch : undefined
  if (typeof demoMatch !== 'boolean') {
    console.error('taste-evaluate: demoMatch must be true or false. The catalog demo is the UX bar.')
    process.exit(2)
  }
  if (demoMatch === false) {
    console.error(
      'taste-evaluate: demoMatch is false. The live control is not the catalog object. Copy the GitHub source; do not wrap it in a cream box.',
    )
    process.exit(2)
  }
  const voice = parsed && typeof parsed === 'object' ? (parsed as { voice?: unknown }).voice : undefined
  const voiceProblems = evaluateVoiceResult(voice, visitorCopy)
  if (voiceProblems.length) {
    console.error(`taste-evaluate: voice failed.\n${voiceProblems.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(2)
  }
  console.log(
    JSON.stringify(
      {
        evaluatorModel: EVALUATOR_MODEL,
        rubricVersion: RUBRIC_VERSION,
        shots: images.map((i) => i.name),
        result: parsed ?? content,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
