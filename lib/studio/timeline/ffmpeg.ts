/**
 * lib/studio/timeline/ffmpeg.ts: which ffmpeg renders a timeline film.
 *
 * The same resolver the output check measures with (lib/studio/qa/measure.ts
 * studioBinaries), so the film is made and measured by one build: FFMPEG_PATH
 * when set (a set path that is missing fails), else /usr/bin, /opt/homebrew/bin,
 * /usr/local/bin, else PATH. Never the pinned installer build, which carries no
 * matching ffprobe.
 */
import { existsSync } from 'node:fs'
import { studioBinaries } from '../qa/measure'

export async function studioFfmpeg(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): Promise<string> {
  return studioBinaries(env, exists).ffmpeg
}
