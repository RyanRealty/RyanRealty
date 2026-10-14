/**
 * npm run video:check -- <final.mp4> [--manifest p] [--brief p] [--final] [--golden p]
 *
 * Opens the finished MP4, measures it against the manifest and the video type
 * rules, writes `<name>.check.json` and `<name>.contact.png` beside it, prints a
 * pass/fail table, and exits 1 on any failure. The contract is
 * docs/plans/STUDIO_ONE_FACTORY.md; the logic is lib/studio/qa/.
 *
 * Exit codes: 0 every check passed, 1 a check failed, 2 bad usage.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { checkVideo } from '../lib/studio/qa/check'
import { writeContactSheet, type ContactResult } from '../lib/studio/qa/contact'
import { parseManifestJson } from '../lib/studio/qa/manifest'
import { USAGE, formatReport, parseArgs } from '../lib/studio/qa/report'
import { typeRulesFor } from '../lib/studio/qa/thresholds'

async function main(): Promise<number> {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`${(e as Error).message}\n${USAGE}`)
    return 2
  }
  if (!existsSync(args.mp4Path)) {
    console.error(`${args.mp4Path} does not exist`)
    return 2
  }

  const report = await checkVideo({
    mp4Path: args.mp4Path,
    manifestPath: args.manifestPath,
    briefPath: args.briefPath,
    golden: args.golden,
    reviewPath: args.reviewPath,
    ledgerPath: args.ledgerPath,
    registryPath: args.registryPath,
    final: args.final,
  })

  const dir = dirname(args.mp4Path)
  const name = basename(args.mp4Path).replace(/\.mp4$/i, '')
  writeFileSync(join(dir, `${name}.check.json`), `${JSON.stringify(report, null, 2)}\n`)

  // The contact sheet is for the reviewer. A failure to draw it never changes the verdict.
  let contact: ContactResult | { error: string } | null = null
  if (args.contact && report.manifest) {
    try {
      const parsed = parseManifestJson(readFileSync(report.manifest, 'utf8'))
      if (!parsed.ok) throw new Error('the manifest is not valid')
      const rules = typeRulesFor(parsed.manifest.videoType)
      if (!rules) throw new Error(`unknown video type ${parsed.manifest.videoType}`)
      contact = await writeContactSheet({ mp4Path: args.mp4Path, manifest: parsed.manifest, hookMaxS: rules.hook_max_s })
    } catch (e) {
      contact = { error: (e as Error).message }
    }
  }

  console.log(formatReport(report, contact))
  console.log(`\nreport: ${join(dir, `${name}.check.json`)}`)
  return report.pass ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e))
    process.exit(1)
  },
)
