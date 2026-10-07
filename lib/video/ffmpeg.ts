/**
 * lib/video/ffmpeg.ts — find an ffmpeg binary, in every runtime the Studio runs in.
 *
 * Where it comes from, in order:
 *  1. FFMPEG_PATH, when an operator points at one.
 *  2. The @ffmpeg-installer binary in node_modules (a developer machine, the
 *     render box, CI).
 *  3. Serverless only: the SAME npm artifact, fetched at runtime into /tmp.
 *
 * Why step 3 exists. next.config.ts strips node_modules/@ffmpeg-installer/**
 * from every function (outputFileTracingExcludes['*'], a 250MB-cap fix), and
 * Next applies excludes after includes, so the binary cannot be traced back
 * into the two functions that run the Studio. Without it a four-beat listing
 * film quietly ships as one beat (film.ts degrades on 'no-ffmpeg') and the
 * motion stage cannot encode at all.
 *
 * The fetch follows @sparticuz/chromium-min, which already downloads Chromium
 * into /tmp for the PDF routes. It is pinned twice: the exact registry tarball
 * the lockfile resolves, and that tarball's sha512, checked before a single
 * byte is unpacked or executed. A tarball that does not match is refused, so
 * a compromised mirror cannot hand us a different binary.
 */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

/**
 * The pinned artifact. `integrity` must equal package-lock.json's entry for
 * node_modules/@ffmpeg-installer/linux-x64 (ffmpeg.test.ts holds that), so a
 * dependency bump that forgets this file fails a test instead of shipping a
 * mismatched download.
 */
export const FFMPEG_PACKAGE = {
  name: '@ffmpeg-installer/linux-x64',
  version: '4.1.0',
  url: 'https://registry.npmjs.org/@ffmpeg-installer/linux-x64/-/linux-x64-4.1.0.tgz',
  integrity:
    'sha512-Y5BWhGLU/WpQjOArNIgXD3z5mxxdV8c41C+U15nsE5yF8tVcdCGet5zPs5Zy3Ta6bU7haGpIzryutqCGQA/W8A==',
  entry: 'package/ffmpeg',
  bytes: 68_174_760,
} as const

/** Where the fetched binary lives for the life of a warm instance. */
export function serverlessFfmpegPath(tmp = '/tmp'): string {
  return join(tmp, `rr-ffmpeg-${FFMPEG_PACKAGE.version}`, 'ffmpeg')
}

function isServerless(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME)
}

/** The installer's own binary, or null when it is not in this runtime. */
function installerPath(): string | null {
  try {
    // A runtime require, not an import: the installer picks a platform
    // sub-package at resolve time, which a bundler cannot follow.
    const requireFromHere = createRequire(import.meta.url)
    const installer = requireFromHere('@ffmpeg-installer/ffmpeg') as { path?: string }
    return installer?.path && existsSync(installer.path) ? installer.path : null
  } catch {
    return null
  }
}

/** sha512 in npm's SRI spelling, so it compares directly with the lockfile. */
export function sriSha512(bytes: Buffer): string {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`
}

/**
 * Pull one regular file out of a tar archive. The npm tarball is plain ustar
 * with no long names, which is all this reads; anything else returns null
 * rather than guessing.
 */
export function extractTarEntry(tar: Buffer, wanted: string): Buffer | null {
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    // Two zero blocks end the archive; one is enough to stop reading.
    if (header.every((byte) => byte === 0)) return null
    const field = (start: number, length: number) =>
      header.subarray(start, start + length).toString('utf8').split('\0')[0]
    const name = field(0, 100)
    const prefix = field(345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const size = Number.parseInt(field(124, 12).trim() || '0', 8)
    const type = field(156, 1)
    if (!Number.isFinite(size) || size < 0) return null
    const dataStart = offset + 512
    if ((type === '0' || type === '') && fullName === wanted) {
      if (dataStart + size > tar.length) return null
      return Buffer.from(tar.subarray(dataStart, dataStart + size))
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return null
}

export type FetchFfmpegDeps = {
  fetchBytes: (url: string) => Promise<Buffer>
  tmp: string
}

const defaultFetchDeps: FetchFfmpegDeps = {
  fetchBytes: async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
    if (!res.ok) throw new Error(`ffmpeg download failed: HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  },
  tmp: '/tmp',
}

/**
 * Fetch, verify, unpack, and mark executable. Throws on any mismatch: the
 * caller turns that into a reported 'no-ffmpeg' outcome.
 */
export async function fetchPinnedFfmpeg(deps: FetchFfmpegDeps = defaultFetchDeps): Promise<string> {
  const target = serverlessFfmpegPath(deps.tmp)
  if (existsSync(target) && statSync(target).size === FFMPEG_PACKAGE.bytes) return target

  const tarball = await deps.fetchBytes(FFMPEG_PACKAGE.url)
  const integrity = sriSha512(tarball)
  if (integrity !== FFMPEG_PACKAGE.integrity) {
    throw new Error(`ffmpeg tarball integrity mismatch (${integrity.slice(0, 24)}...)`)
  }
  const binary = extractTarEntry(gunzipSync(tarball), FFMPEG_PACKAGE.entry)
  if (!binary || binary.length !== FFMPEG_PACKAGE.bytes) {
    throw new Error('ffmpeg tarball did not contain the expected binary')
  }

  await mkdir(join(target, '..'), { recursive: true })
  // Write beside, then rename: a concurrent reader never sees half a binary.
  const partial = `${target}.${process.pid}.partial`
  await writeFile(partial, binary)
  await chmod(partial, 0o755)
  await rename(partial, target)
  return target
}

let pending: Promise<string | null> | null = null

/**
 * Resolve an ffmpeg binary, or null when this runtime cannot have one.
 * Never throws. One download per warm instance, however many callers ask.
 */
export function resolveFfmpeg(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const explicit = env.FFMPEG_PATH?.trim()
  if (explicit && existsSync(explicit)) return Promise.resolve(explicit)

  const local = installerPath()
  if (local) return Promise.resolve(local)

  if (!isServerless(env) || process.platform !== 'linux' || process.arch !== 'x64') {
    return Promise.resolve(null)
  }
  if (!pending) {
    pending = fetchPinnedFfmpeg().catch((err) => {
      console.error('[video/ffmpeg] pinned ffmpeg unavailable:', err instanceof Error ? err.message : err)
      // Let the next request try again rather than caching the failure.
      pending = null
      return null
    })
  }
  return pending
}
