/**
 * Step voice (video only): the paid voice, once, after the brief has passed.
 *
 * "Paid steps run late and once" (CONTENT_PROCESS.md): ElevenLabs is called here
 * and nowhere else in the process. The synthesis goes through the existing cache
 * (lib/studio/timeline/voice.ts), so a second call for the same script costs
 * nothing, and the board and the master read it back from there. Its real
 * timing must fit the beats: speakTimeline refuses a voice that runs into the
 * end card and captions that cannot hold their rules.
 */
import { join } from 'node:path'
import { endcardStartSeconds } from '../../../studio/timeline/plan'
import { parseTimeline } from '../../../studio/timeline/validate'
import { speakTimeline, type VoiceProvider } from '../../../studio/timeline/voice'
import { hashJson } from '../canonical'
import { classify } from '../classify'
import type { RunContext, StepDef } from '../context'

/** The provider every step after voice is handed: the paid voice is refused outside step voice. */
export const paidVoiceRefused: VoiceProvider = async () => {
  throw new Error('the paid voice runs only in step voice, and its synthesis was not in the cache: run step voice again')
}

/** The film's voice from the cache. Only step voice passes the real provider; every other step gets paidVoiceRefused. */
export async function filmVoice(ctx: RunContext, paid: boolean): Promise<NonNullable<RunContext['state']['voice']> | null> {
  if (ctx.state.voice !== undefined) return ctx.state.voice
  const t = parseTimeline(ctx.timeline)
  if (!t.ok || !t.value.voice) {
    ctx.state.voice = null
    return null
  }
  const speak = ctx.deps.render.speak ?? speakTimeline
  const voice = await speak(t.value.voice, {
    provider: paid ? ctx.deps.render.voiceProvider : paidVoiceRefused,
    cacheDir: join(ctx.cacheDir, 'voice'),
    ffmpeg: ctx.deps.render.ffmpeg,
    captionsUntil: endcardStartSeconds(t.value),
    env: ctx.deps.render.env ?? process.env,
    voiceId: ctx.deps.voiceId,
  })
  ctx.state.voice = voice
  return voice
}

export const voiceStep: StepDef = {
  id: 'voice',
  async parts() {
    return {}
  },
  async run(ctx) {
    const t = parseTimeline(ctx.timeline)
    if (!t.ok) return { problems: [classify('the timeline is not valid, so there is nothing to speak')], outputs: {} }
    if (!t.value.voice) return { problems: [], outputs: { voice: null, words: 0 }, status: 'not needed' }
    try {
      const voice = await filmVoice(ctx, true)
      if (!voice) return { problems: [], outputs: { voice: null, words: 0 }, status: 'not needed' }
      const last = voice.words[voice.words.length - 1]
      ctx.log(`voice: ${voice.words.length} words, ${voice.captions.length} captions, ${voice.cached ? 'from the cache' : 'synthesized'} (${voice.model})`)
      return {
        problems: [],
        outputs: {
          model: voice.model,
          voiceId: voice.voiceId,
          offset: voice.offset,
          words: voice.words.length,
          captions: voice.captions.length,
          lastWordEnd: last.end,
          wordsSha256: hashJson(voice.words),
        },
        // Whether this run paid for the voice or read the cache is the one thing a re-run with the same
        // script changes. It is reported, not hashed: in outputs it would change outputsSha256 and
        // invalidate the board and master stamps built on the voice.
        report: { cached: voice.cached },
      }
    } catch (e) {
      return { problems: [classify((e as Error).message)], outputs: {} }
    }
  },
}
