#!/usr/bin/env node
/**
 * G32 / R-213 lock: one generative product (xAI).
 *
 *   node scripts/check-xai-stack.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const DISPOSITIONS = new Set(['cancel-now', 'cancel-after-cutover', 'keep-not-gen'])

const voice = src('lib/grok-voice.ts')
checks.push({
  label: 'lib/grok-voice.ts is the TTS + STT chokepoint',
  ok:
    existsSync('lib/grok-voice.ts') &&
    /export async function synthesizeGrokVoice/.test(voice) &&
    /export async function transcribeGrokAudio/.test(voice) &&
    /export const XAI_VOICE_ID_DEFAULT = 'eve'/.test(voice) &&
    voice.includes('https://api.x.ai/v1/tts') &&
    voice.includes('https://api.x.ai/v1/stt') &&
    voice.includes('PLACE_NAME_REPLACE') &&
    voice.includes('with_timestamps'),
})

const text = src('lib/grok-text.ts')
checks.push({
  label: 'lib/grok-text.ts uses grok-4.6 Responses API',
  ok:
    /export const GROK_TEXT_MODEL = 'grok-4.6'/.test(text) &&
    text.includes('https://api.x.ai/v1/responses'),
})

checks.push({
  label: 'image + video chokepoints exist',
  ok: existsSync('lib/grok-image.ts') && existsSync('lib/grok-video.ts'),
})

const recording = src('app/api/twilio/recording/route.ts')
checks.push({
  label: 'Twilio recording STT goes through grok-voice, not ElevenLabs',
  ok:
    /from ['"]@\/lib\/grok-voice['"]/.test(recording) &&
    /transcribeGrokAudio\(/.test(recording) &&
    !recording.includes('api.elevenlabs.io'),
})

const synthesia = src('app/actions/synthesia.ts')
checks.push({
  label: 'Synthesia generate is refused (cancel-now has no live path)',
  ok:
    /configured: false/.test(synthesia) &&
    /ok: false/.test(synthesia) &&
    !synthesia.includes('api.synthesia.io'),
})

let accept
try {
  accept = JSON.parse(src('docs/plans/ENTERPRISE_MAP/xai-stack-accept.json'))
} catch {
  accept = null
}

const vendors = [
  ...(accept?.cancelNow ?? []).map((r) => ({ ...r, disposition: 'cancel-now' })),
  ...(accept?.cancelAfterCutover ?? []).map((r) => ({ ...r, disposition: 'cancel-after-cutover' })),
  ...(accept?.keepNotGen ?? []).map((r) => ({ ...r, disposition: 'keep-not-gen' })),
]

const requiredVendors = [
  'fal.ai',
  'Synthesia',
  'ElevenLabs',
  'Replicate',
  'OpenAI',
  'Anthropic',
  'xAI',
  'Remotion',
]

checks.push({
  label: 'xai-stack-accept.json lists every billed gen vendor with a disposition',
  ok:
    accept?.complete === true &&
    accept?.requirement === 'R-213' &&
    accept?.chokepoint?.voice === 'lib/grok-voice.ts' &&
    vendors.every((v) => DISPOSITIONS.has(v.disposition) && typeof v.vendor === 'string') &&
    requiredVendors.every((name) => vendors.some((v) => v.vendor === name)),
})

checks.push({
  label: 'cancel-now rows name no required live generate path',
  ok: (accept?.cancelNow ?? []).every(
    (row) =>
      row.vendor === 'fal.ai' ||
      (row.vendor === 'Synthesia' && /refuse|canceled|no required/i.test(String(row.why))),
  ),
})

const brief = src('docs/plans/ENTERPRISE_MAP/xai-stack.md')
checks.push({
  label: 'xai-stack.md names grok-voice and the required xAI doc reads',
  ok:
    brief.includes('lib/grok-voice.ts') &&
    brief.includes('https://docs.x.ai/overview') &&
    brief.includes('text-to-speech') &&
    brief.includes('speech-to-text') &&
    brief.includes('custom-voices') &&
    !brief.includes('lib/grok-voice.ts (G32 adds)'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\nxai-stack: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nxai-stack: ${checks.length}/${checks.length}`)
