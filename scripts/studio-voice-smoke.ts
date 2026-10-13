/**
 * scripts/studio-voice-smoke.ts: one live ElevenLabs call, to prove lib/studio/voice works.
 *
 * NOT run in CI (it spends a fraction of a cent and needs ELEVENLABS_API_KEY and
 * ELEVENLABS_VOICE_ID_ELLEN). Synthesizes one short line with the Ellen voice on
 * eleven_v3 (falling back to eleven_multilingual_v2, plain text, only if the API
 * refuses v3 for the voice, and saying so), then writes
 *
 *   out/voice-smoke/line.wav         the voice, 48 kHz stereo 16-bit
 *   out/voice-smoke/alignment.json   the engine's character timing + what was sent
 *   out/voice-smoke/words.json       word timings (tags and ellipses dropped)
 *   out/voice-smoke/captions.json    caption cards
 *
 * and prints the word timings, the cards and the measured loudness. Nothing
 * here is sent to a person.
 *
 *   npx tsx scripts/studio-voice-smoke.ts
 *   npx tsx scripts/studio-voice-smoke.ts --text "[warm] Your line here."
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { encodeWav, integratedLoudness, truePeakDb } from '../lib/studio/score'
import {
  DEFAULT_MODEL,
  ElevenLabsError,
  FALLBACK_MODEL,
  alignmentToWords,
  decodeVoiceAudio,
  manifestVoice,
  planCaptions,
  spawnFfmpeg,
  synthesizeWithTimestamps,
  voiceIdFor,
  type Synthesis,
} from '../lib/studio/voice'

const OUT_DIR = join(process.cwd(), 'out', 'voice-smoke')
const DEFAULT_LINE = "Okay, so... here's the thing."

function argValue(name: string): string | undefined {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

async function main(): Promise<void> {
  const voiceId = voiceIdFor('ellen')
  const text = argValue('--text') ?? DEFAULT_LINE
  const notes: string[] = []

  let synthesis: Synthesis
  try {
    synthesis = await synthesizeWithTimestamps({ text, voiceId, model: DEFAULT_MODEL })
  } catch (error) {
    if (!(error instanceof ElevenLabsError) || error.status < 400 || error.status >= 500 || error.status === 401 || error.status === 429) throw error
    notes.push(`${DEFAULT_MODEL} was refused (HTTP ${error.status}: ${error.detail}); retrying on ${FALLBACK_MODEL} with the audio tags removed`)
    console.warn(notes.at(-1))
    synthesis = await synthesizeWithTimestamps({ text: text.replace(/\[[^\]]*\]\s*/g, ''), voiceId, model: FALLBACK_MODEL })
  }
  for (const refusal of synthesis.refusedFormats) {
    notes.push(`output format ${refusal.format} was refused (HTTP ${refusal.status}: ${refusal.detail})`)
  }

  const audio = await decodeVoiceAudio(synthesis.audio, synthesis.outputFormat, { runFfmpeg: spawnFfmpeg(process.env.FFMPEG_PATH || 'ffmpeg') })
  const words = alignmentToWords(synthesis.alignment)
  const plan = planCaptions(words)
  const wav = encodeWav(audio.left, audio.right, 'voice-smoke')

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'line.wav'), wav)
  await writeFile(
    join(OUT_DIR, 'alignment.json'),
    JSON.stringify(
      {
        engine: synthesis.engine,
        model: synthesis.model,
        voiceId: synthesis.voiceId,
        outputFormat: synthesis.outputFormat,
        textSent: synthesis.text,
        voiceSettings: synthesis.voiceSettings,
        requestId: synthesis.requestId,
        notes,
        alignment: synthesis.alignment,
        normalizedAlignment: synthesis.normalizedAlignment,
      },
      null,
      2,
    ),
  )
  await writeFile(join(OUT_DIR, 'words.json'), JSON.stringify(manifestVoice(synthesis, words), null, 2))
  await writeFile(join(OUT_DIR, 'captions.json'), JSON.stringify({ captions: plan.cards, violations: plan.violations }, null, 2))

  const seconds = audio.left.length / 48000
  console.log(`model ${synthesis.model}, format ${synthesis.outputFormat}, text sent: ${JSON.stringify(synthesis.text)}`)
  console.log(`audio ${seconds.toFixed(3)} s (${audio.left.length} samples at 48000 Hz)`)
  console.log('words:')
  for (const w of words) console.log(`  ${w.start.toFixed(3)} - ${w.end.toFixed(3)}  ${w.word}`)
  console.log('captions:')
  for (const c of plan.cards) console.log(`  ${c.start.toFixed(3)} - ${c.end.toFixed(3)}  ${JSON.stringify(c.text)}  words ${JSON.stringify(c.words)}`)
  console.log(`caption rule violations: ${plan.violations.length === 0 ? 'none' : plan.violations.join('; ')}`)
  console.log(`loudness (BS.1770-4, lib/studio/score): ${integratedLoudness(audio.left, audio.right).toFixed(2)} LUFS, true peak ${truePeakDb(audio.left, audio.right).toFixed(2)} dBTP`)
  for (const note of notes) console.log(`note: ${note}`)
  console.log(`wrote ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}${error instanceof ElevenLabsError && error.detail ? ` | ${error.detail}` : ''}` : error)
  process.exit(1)
})
