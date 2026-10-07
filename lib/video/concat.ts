/**
 * lib/video/concat.ts — cut the beats together.
 *
 * The cut always re-encodes, and that is deliberate. Grok returns 1080p at
 * roughly 32 Mbps: 24MB for six seconds. Four of those stream-copied together
 * is ~96MB, which the storage bucket rejected outright and which no one wants
 * arriving on a phone. One pass at CRF 21 puts the same six seconds at 6.7MB
 * with no visible loss, so a four-beat film lands near 27MB and is a file you
 * can actually post.
 *
 * ffmpeg comes from lib/video/ffmpeg.ts: the local installer on a developer
 * machine or the render box, a pinned and verified download inside a
 * serverless function. When neither is possible the caller degrades to a
 * single beat instead of failing. A film that quietly became one shot must
 * say so, which is why the result reports what actually happened.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveFfmpeg } from './ffmpeg'

export type ConcatResult =
  | { ok: true; body: Buffer; method: 'passthrough' | 'encode'; clips: number }
  | { ok: false; error: string; reason: 'no-ffmpeg' | 'failed' }

/**
 * Social delivery ladder. Generous enough that a slow push over juniper does
 * not band, small enough to send.
 */
const ENCODE_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '21',
  '-maxrate', '8M',
  '-bufsize', '16M',
  '-pix_fmt', 'yuv420p',
  // Generated video carries no audio and we never want an invented one.
  '-an',
  '-movflags', '+faststart',
]

function run(bin: string, args: string[], timeoutMs = 240_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stderr?.on('data', (chunk) => {
      // Keep only the tail: ffmpeg is chatty and the useful part is at the end.
      stderr = (stderr + String(chunk)).slice(-4000)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stderr })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stderr: err.message })
    })
  })
}

/**
 * Concatenate MP4 clips in order. Returns the joined file as bytes.
 * Never throws: a failure is a reported outcome so the caller can fall back.
 */
export async function concatMp4(clips: Buffer[]): Promise<ConcatResult> {
  if (clips.length === 0) return { ok: false, error: 'no clips', reason: 'failed' }
  if (clips.length === 1) return { ok: true, body: clips[0], method: 'passthrough', clips: 1 }

  const bin = await resolveFfmpeg()
  if (!bin) return { ok: false, error: 'ffmpeg is not available in this runtime', reason: 'no-ffmpeg' }

  const dir = await mkdtemp(join(tmpdir(), 'studio-concat-'))
  try {
    const paths: string[] = []
    for (const [index, clip] of clips.entries()) {
      const path = join(dir, `beat-${index}.mp4`)
      await writeFile(path, clip)
      paths.push(path)
    }
    // The concat demuxer takes a manifest, not a shell-quoted list, which is
    // also why a path with a quote in it cannot break this.
    const manifest = join(dir, 'beats.txt')
    await writeFile(manifest, paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
    const out = join(dir, 'film.mp4')

    const encoded = await run(bin, [
      '-y', '-f', 'concat', '-safe', '0', '-i', manifest,
      ...ENCODE_ARGS, out,
    ])
    if (encoded.code === 0) {
      return { ok: true, body: await readFile(out), method: 'encode', clips: clips.length }
    }

    return { ok: false, error: encoded.stderr.slice(-600) || 'ffmpeg failed', reason: 'failed' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'concat failed', reason: 'failed' }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
