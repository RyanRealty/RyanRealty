/**
 * lib/studio/timeline/manifest.ts: write `final.manifest.json`, validated first.
 *
 * The manifest is the factory's word about the film (docs/plans/
 * STUDIO_ONE_FACTORY.md). It is written only after lib/studio/qa/manifest.ts
 * parses it clean with unknown keys refused, the same parser video:check uses,
 * so a manifest the check would reject is never written at all.
 */
import { writeFileSync } from 'node:fs'
import { formatManifestIssues, parseManifest, type Manifest } from '../qa/manifest'

export class ManifestWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestWriteError'
  }
}

/** Validate a manifest and return the JSON text to write. Throws ManifestWriteError naming every issue. */
export function serializeManifest(manifest: Manifest): string {
  const text = `${JSON.stringify(manifest, null, 2)}\n`
  const parsed = parseManifest(JSON.parse(text))
  if (!parsed.ok) throw new ManifestWriteError(`the manifest is not valid, so it was not written: ${formatManifestIssues(parsed.errors, 20)}`)
  return text
}

/** Validate, then write. */
export function writeManifest(path: string, manifest: Manifest): void {
  writeFileSync(path, serializeManifest(manifest))
}
