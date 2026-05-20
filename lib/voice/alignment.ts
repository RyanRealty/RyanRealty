/**
 * lib/voice/alignment.ts — ElevenLabs Victoria TTS + forced-alignment helper
 * for Node/TS callers. Companion to `scripts/_voice_lib.py` for Python
 * producers; both modules MUST stay in sync with the canonical settings
 * in `video_production_skills/elevenlabs_voice/SKILL.md`.
 *
 * Listed as a BLOCKER in skills/youtube-market-reports/{SKILL.md,pipeline.md,
 * tool-inventory.md}. Builds the AudioBuffer + word-level AlignmentWord[]
 * that the CaptionBand and per-scene timing both consume.
 *
 * Hard rules (per video_production_skills/elevenlabs_voice/SKILL.md §
 * "Canonical voice settings" — locked 2026-05-07, conversational tuning):
 *   - Voice Victoria — voice ID `qSeXEcewz7tA0Q0qk9fH` (LOCKED 2026-04-27).
 *   - Model `eleven_turbo_v2_5` (eleven_v3 only when <phoneme> tags present).
 *   - Settings: stability 0.40, similarity_boost 0.80, style 0.50, speaker_boost true.
 *   - `previous_text` chained across all segments for prosody continuity.
 *   - Output format: `mp3_44100_128`.
 *   - Forced-alignment via /v1/forced-alignment for word-level caption sync.
 *
 * Why client-managed (no SDK): the official ElevenLabs Node SDK adds 5+
 * transitive deps. Two fetch calls per segment is small enough to run on
 * the standard fetch API without pulling in a wrapper.
 */

import {
  type AlignmentWord,
  FPS,
  type Voice,
  type VoiceSegment,
} from '../../video/market-report/src/VideoProps';
import type { SceneScript } from '../youtube-market-report/generate-script';

// ---------------------------------------------------------------------------
// Voice constants — these match the brand-system.md spec and are LOCKED.
// ---------------------------------------------------------------------------

export const VICTORIA_VOICE_ID = 'qSeXEcewz7tA0Q0qk9fH';
export const VICTORIA_MODEL_ID = 'eleven_turbo_v2_5';
export const VICTORIA_OUTPUT_FORMAT = 'mp3_44100_128';

export const VICTORIA_SETTINGS = {
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.5,
  use_speaker_boost: true,
} as const;

/**
 * A/B test variants. Use when a script may read robotic at the baseline
 * settings. Generate all three, listen, pick the most natural, lock its
 * settings via the per-call override.
 */
export const VICTORIA_AB_VARIANTS = {
  baseline: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  expressive: { stability: 0.3, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
  controlled: { stability: 0.55, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
} as const;

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SynthesizeOptions {
  /** Override the API key (defaults to ELEVENLABS_API_KEY). */
  apiKey?: string;
  /** Optional fetch implementation for tests. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** previous_text for prosody chaining across segments. */
  previousText?: string;
}

/**
 * Raw forced-alignment response from ElevenLabs (subset). The API returns
 * either `words` or `characters` arrays depending on the model; we read the
 * `words` array for caption sync.
 */
export interface ForcedAlignmentApiResponse {
  words?: Array<{ text?: string; word?: string; start?: number; end?: number }>;
}

// ---------------------------------------------------------------------------
// Single-segment synthesize + align
// ---------------------------------------------------------------------------

/**
 * Call ElevenLabs TTS for a single segment. Returns the raw mp3 bytes.
 * Throws on non-2xx with the response body for diagnostic purposes.
 */
export async function synthesizeVictoria(
  text: string,
  options: SynthesizeOptions = {},
): Promise<Uint8Array> {
  const apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const body: Record<string, unknown> = {
    model_id: VICTORIA_MODEL_ID,
    voice_settings: VICTORIA_SETTINGS,
    text,
    output_format: VICTORIA_OUTPUT_FORMAT,
  };
  if (options.previousText) body.previous_text = options.previousText;

  const res = await fetchImpl(`${ELEVENLABS_BASE}/text-to-speech/${VICTORIA_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Call ElevenLabs forced-alignment with audio bytes + reference text. Returns
 * the raw API response (caller maps it to AlignmentWord[]).
 */
export async function forcedAlignment(
  audioBytes: Uint8Array,
  referenceText: string,
  options: SynthesizeOptions = {},
): Promise<ForcedAlignmentApiResponse> {
  const apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  // The /v1/forced-alignment endpoint accepts multipart form-data with the
  // audio file + reference text. Use Blob to wrap the bytes.
  const form = new FormData();
  form.append('file', new Blob([audioBytes as unknown as ArrayBuffer], { type: 'audio/mpeg' }), 'segment.mp3');
  form.append('text', referenceText);

  const res = await fetchImpl(`${ELEVENLABS_BASE}/forced-alignment`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs alignment failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<ForcedAlignmentApiResponse>;
}

// ---------------------------------------------------------------------------
// Frame conversion + AlignmentWord mapping
// ---------------------------------------------------------------------------

/** Convert seconds to frames at FPS=30 with the same Math.round used by VideoProps. */
export function secondsToFrame(seconds: number): number {
  return Math.round(seconds * FPS);
}

/** Map a forced-alignment API response to typed AlignmentWord[] for one segment. */
export function mapAlignmentResponse(
  response: ForcedAlignmentApiResponse,
  sceneIndex: number,
): AlignmentWord[] {
  const words = response.words ?? [];
  return words
    .map((w) => {
      const startSeconds = typeof w.start === 'number' ? w.start : NaN;
      const endSeconds = typeof w.end === 'number' ? w.end : NaN;
      const text = (w.text ?? w.word ?? '').trim();
      if (!text || !Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return null;
      return {
        word: text,
        startSeconds,
        endSeconds,
        startFrame: secondsToFrame(startSeconds),
        endFrame: secondsToFrame(endSeconds),
        segmentIndex: sceneIndex,
      };
    })
    .filter((x): x is AlignmentWord => x !== null);
}

// ---------------------------------------------------------------------------
// Multi-segment orchestrator: script → Voice
// ---------------------------------------------------------------------------

export interface SynthesizeAndAlignInput {
  scenes: readonly SceneScript[];
  /** Path-write callback. Receives the segment's mp3 bytes + a stable filename. */
  writeAudio: (filename: string, bytes: Uint8Array) => Promise<string>;
  /** Path-write callback for the alignment JSON. */
  writeAlignment: (filename: string, json: unknown) => Promise<string>;
  options?: SynthesizeOptions;
}

/**
 * Synthesize each scene + run forced alignment. Chains `previous_text` across
 * scenes for prosody continuity. Returns the Voice subobject ready to drop
 * into VideoProps.
 *
 * Side effects only via the caller-provided `writeAudio` / `writeAlignment`
 * callbacks — keeps this module file-system agnostic and easy to unit-test.
 */
export async function synthesizeAndAlign(input: SynthesizeAndAlignInput): Promise<Voice> {
  const segments: VoiceSegment[] = [];
  let previousText = '';
  let totalDuration = 0;

  for (const scene of input.scenes) {
    const audioBytes = await synthesizeVictoria(scene.ttsText, {
      ...input.options,
      previousText,
    });
    const audioFilename = `scene${scene.sceneIndex}.mp3`;
    const audioPath = await input.writeAudio(audioFilename, audioBytes);

    const alignment = await forcedAlignment(audioBytes, scene.text, input.options);
    const words = mapAlignmentResponse(alignment, scene.sceneIndex);

    const durationSeconds = words.length > 0
      ? Math.max(...words.map((w) => w.endSeconds))
      : approximateDurationFromText(scene.text);

    segments.push({
      sceneIndex: scene.sceneIndex,
      audioPath,
      durationSeconds,
      text: scene.ttsText,
      words,
    });
    totalDuration += durationSeconds;
    previousText = scene.text;
  }

  // Persist the combined alignment JSON. Caller decides where the file lands;
  // we just give them the canonical name + payload.
  const alignmentPath = await input.writeAlignment('alignment.json', {
    schemaVersion: '1.0.0',
    voiceId: VICTORIA_VOICE_ID,
    modelId: VICTORIA_MODEL_ID,
    segments,
  });

  return {
    voiceId: VICTORIA_VOICE_ID,
    modelId: VICTORIA_MODEL_ID,
    alignmentPath,
    segments,
    totalDurationSeconds: totalDuration,
  };
}

/** Fallback when alignment returns no words: estimate from word count at 150 WPM. */
function approximateDurationFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60);
}
