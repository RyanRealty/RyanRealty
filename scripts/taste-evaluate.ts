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
} from './lib/taste-catalog.mjs'

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

config({ path: '.env.local' })

const UI_KITS = 'design_system/ryan-realty/ui_kits'

/**
 * TASTE.md's rubric, quoted rather than paraphrased. The evaluator's prompt
 * wording is itself a design lever (Anthropic found "museum quality" pushed
 * outputs into an unintended register), so this uses that file's own words —
 * quiet, editorial, expensive, data-first, Central Oregon — and never "modern
 * SaaS".
 */
const RUBRIC = `
You are judging one page of a Bend, Oregon real-estate brokerage's public website.
The house register is QUIET, EDITORIAL, EXPENSIVE and DATA-FIRST: navy #102742 on
cream #faf8f4, two colors only, hairline rules, no elevation shadows, radius 0 on
every box, a display serif on headings and figures, tabular numerals, Central
Oregon subject matter. Judge it against the best version of the idea you have
seen, not against a generic web page. Never reach for "modern SaaS" as a
compliment or a criticism; it is not the register in question.

Score five criteria, weighted, out of 100 total:

| Criterion | Weight | Passing looks like |
|---|---|---|
| Design quality | 30 | One coherent identity across the page; rhythm, not a stack. A reader could name the brand from a cropped section. |
| Originality | 30 | Deliberate choices a template would not make. The reader would screenshot a section to show someone. No section shape repeats down the page. |
| Interaction | 15 | Every data section rewards a hover, tap, scrub, or toggle with more data. Nothing moves for decoration. |
| Craft | 15 | Hierarchy by size AND weight, spacing on the scale, AA contrast, tabular numerals, no orphaned labels at 375, and one radius and one spacing rhythm across everything visible in a viewport. |
| Honesty and function | 10 | Every figure has its source trace; loading, empty, and error states render; the page's job completes in one path. |

BANNED TELLS, each of which costs points wherever you see one:
- Walls of text: a section whose main content is more than two paragraphs of prose with no figure, image, map or interactive element.
- Scrolling lists as the design: a list past six rows with no visual encoding.
- KPI grids: a number, a percentage and jargon, with no plain sentence saying what it means for the reader.
- The stacked-section page: three or more consecutive sections built as eyebrow, heading, rows, source.
- Raw slugs, internal labels or methodology jargon in anything a visitor reads.
- Purple gradients, Inter/Roboto, icon card grids, frosted glass, shadow soup, centered-everything heroes, emoji headers, hover bounce.
- Missing states: a display that only renders the happy path.
`.trim()

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

  const question = [
    RUBRIC,
    '',
    `The shots, in order: ${images.map((i) => i.name).join(', ')}.`,
    'Names ending -desktop are 1440px wide; names ending -mobile375 are 375px wide.',
    args.url ? `The page is rendered at ${args.url}.` : '',
    args.focus ? `What changed in this pass: ${args.focus}` : '',
    catalogNote,
    bar,
    '',
    'Score the SAME shots THREE separate times, independently, as three different reviewers would. One pass is noise.',
    'Honesty is not a trade. A prettier fold that hides a sourced figure, drops JSON-LD, removes an ask, or makes a number unverifiable is a blocking defect. UI/UX may rise; honestyFunction must hold or improve. Omitting honesty to skip the hold is a blocking defect. requiredComponents, JSON-LD, titles, conversion asks, tap targets, and page payload must hold or improve.',
    'Then list the named defects behind the number: each one names the section (a css class or an id you can see), the severity (blocking | taste | craft), a finding of at least ten characters that says what is wrong, not what you would like, and replaceWith — a house primitive or catalog module id, or null if the finding is craft/honesty not form.',
    'Empty defects is only allowed above 95.',
    'Answer as JSON: {"scores":[n,n,n],"score":<median>,"perCriterion":{"design":n,"originality":n,"interaction":n,"craft":n,"honesty":n},"beats":"<the competing page you would compare this to and the metric we win or lose>","defects":[{"section":"...","severity":"...","finding":"...","replaceWith":"<id or null>"}],"verdict":"<two sentences>"}',
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
    'You are a design critic reviewing a page you did not build. You are hard to impress and you say why. You never praise a page for being clean; clean is the floor. You name what is dull.',
    '',
    `Read these screenshot files with your file tool and judge what is IN them:`,
    ...images.map((i) => `  ${resolve(i.path)}`),
    '',
    question,
    '',
    'Reply with the JSON object and nothing else — no preamble, no code fence.',
  ].join('\n')

  const res = spawnSync(
    GROK_CLI,
    ['-p', prompt, '-m', EVALUATOR_MODEL, '--permission-mode', 'bypassPermissions', '--output-format', 'plain'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000 },
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
  }
  console.log(
    JSON.stringify(
      {
        evaluatorModel: EVALUATOR_MODEL,
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
