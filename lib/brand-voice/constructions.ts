/**
 * GENERATED FILE — do not edit.
 *
 * In-bundle mirror of scripts/voice-constructions.cjs, which is the
 * machine-readable form of the 'Banned constructions' section of
 * marketing_brain_skills/brand-voice/VOICE.md.
 *
 * Regenerate: node scripts/gen-voice-constructions.mjs --write
 * Parity enforced by ci:voice-constructions-parity.
 */

export type VoiceConstruction = {
  id: string
  rule: number
  label: string
  source: string
  fix: string
}

export const VOICE_CONSTRUCTIONS: readonly VoiceConstruction[] = [
  {
    "id": "invented-attribution",
    "rule": 1,
    "label": "puts words in a named person's mouth",
    "source": "[\"\\u201d\\u2019']\\s*,?\\s*(said|says)\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+|[A-Z][a-z]+\\s+[A-Z][a-z]+,\\s*(principal\\s+)?broker\\s*:\\s*[a-z]",
    "fix": "State it plainly in the brokerage voice, or cut it. Never attach a name to a sentence nobody said."
  }
] as const
