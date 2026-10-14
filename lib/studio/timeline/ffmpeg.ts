/**
 * lib/studio/timeline/ffmpeg.ts: which ffmpeg renders a timeline film.
 *
 * FFMPEG_PATH when an operator sets one, else the system build at
 * /usr/bin/ffmpeg (every filter the plate and the check use), else the
 * Studio's own resolver (lib/video/ffmpeg.ts: the pinned installer build, 4.1).
 * The order matches the output check's resolver (lib/studio/qa/measure.ts), so
 * the film is made and measured by the same binary.
 */
import { existsSync } from 'node:fs'
import { resolveFfmpeg } from '@/lib/video/ffmpeg'

export async function studioFfmpeg(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): Promise<string> {
  const explicit = env.FFMPEG_PATH?.trim()
  if (explicit && exists(explicit)) return explicit
  if (exists('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg'
  const resolved = await resolveFfmpeg(env)
  if (!resolved) throw new Error('ffmpeg is not available: set FFMPEG_PATH')
  return resolved
}
