/**
 * lib/agent/exif.ts — EXIF extraction for property-shoot ingestion.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md Amendment R2.7: "GPS does double
 * duty — confirms the property match and flags wrong-property outliers in a
 * batch." Capture date lets ingest note when the shoot actually happened
 * (vs. when it landed in Gmail).
 *
 * `exifr` is NOT an npm dependency yet (Matt directive for this rung: do not
 * touch package.json or run npm install — R2.7 ships greenfield and the
 * dependency lands in a follow-up commit). Loaded via a dynamic import
 * behind a NON-LITERAL specifier on purpose:
 *   - TypeScript only attempts module resolution on `import()` calls whose
 *     specifier is a string literal; a variable specifier types the result
 *     `any` and skips the "Cannot find module" check entirely.
 *   - Next.js's bundler (webpack/Turbopack) only statically resolves literal
 *     import() specifiers into the build graph; a variable specifier is left
 *     as a runtime dynamic require, so a missing package degrades to a
 *     runtime throw (caught below) instead of a build failure.
 * Do NOT inline the string 'exifr' into the import() call — that turns this
 * back into a hard, build-breaking dependency.
 *
 * Until `npm i exifr` lands, every call fails closed to `{}` with ONE
 * console warning per process (not per call — a batch of 30 photos should
 * not spam the log).
 */


export interface ExifResult {
  capturedAt?: string
  lat?: number
  lng?: number
}

const EXIFR_MODULE_NAME = 'exifr'

let warnedMissing = false
function warnOnce(detail: string): void {
  if (warnedMissing) return
  warnedMissing = true
  console.warn(`lib/agent/exif: npm i exifr pending — EXIF disabled (${detail})`)
}

type ExifrParseFn = (input: Buffer, options?: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
type ExifrModule = { parse?: ExifrParseFn; default?: { parse?: ExifrParseFn } }

async function loadExifr(): Promise<ExifrModule | null> {
  try {
    // Non-literal specifier — see module doc.
    const mod = (await import(EXIFR_MODULE_NAME)) as ExifrModule
    return mod
  } catch (err) {
    warnOnce(err instanceof Error ? err.message : String(err))
    return null
  }
}

function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Best-effort EXIF read: capture date + GPS lat/lng only (everything ingest
 * needs — R2.7's GPS-outlier check and the capture-date note). Never throws;
 * any failure (missing dependency, corrupt file, no EXIF block, GPS
 * stripped by the sender's platform) resolves to `{}` so
 * lib/agent/assets.ts's ingest ladder always has a value to destructure.
 */
export async function readExif(buffer: Buffer): Promise<ExifResult> {
  const exifr = await loadExifr()
  if (!exifr) return {}

  const parseFn = exifr.parse ?? exifr.default?.parse
  if (typeof parseFn !== 'function') {
    warnOnce('module loaded but no parse() export found')
    return {}
  }

  try {
    // `gps: true` is exifr's convenience flag that merges GPS IFD tags into
    // top-level `latitude`/`longitude` floats — read those first, falling
    // back to the raw GPS tag names defensively (exact merged-key shape is
    // unverified since the package isn't installed for this rung).
    const parsed = await parseFn(buffer, { gps: true })
    if (!parsed) return {}
    return {
      capturedAt: toIsoDate(parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.ModifyDate),
      lat: toFiniteNumber(parsed.latitude ?? parsed.GPSLatitude),
      lng: toFiniteNumber(parsed.longitude ?? parsed.GPSLongitude),
    }
  } catch (err) {
    warnOnce(err instanceof Error ? err.message : String(err))
    return {}
  }
}
