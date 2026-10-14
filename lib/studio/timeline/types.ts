/**
 * lib/studio/timeline/types.ts: what `npm run studio:render` reads.
 *
 * Two files, both written to the ryan-studio skill
 * (.claude/skills/ryan-studio/templates/brief.schema.json for the brief):
 *
 *  - brief.json: the paperwork video_gate checks. The renderer reads its video
 *    type, techniques, numbers (each with its full citation) and spec rules.
 *  - timeline.json: today's beats (id, role, start, end, text, number, boxes),
 *    extended with what the renderer needs to make the picture: per beat
 *    `footage`, `scene` and `cards`; top level `voice`, `cta`, `score`.
 *
 * Seconds everywhere, on the film's own clock (0 is the first frame).
 */

/** Roles a timeline beat may take (video_gate's sequence). The topic CTA is top-level `cta`. */
export const TIMELINE_ROLES = ['hook', 'intro', 'body', 'payoff', 'endcard'] as const
export type TimelineRole = (typeof TIMELINE_ROLES)[number]

export type TimelineFootage = {
  /** A local path (relative to the timeline file) or an https URL. */
  src: string
  /** Seconds into the clip where the beat's picture starts. Default 0. */
  in?: number
  /** 'hold' keeps the clip's own camera move; 'pan' also glides the crop window when the clip has room. Default 'hold'. */
  move?: 'hold' | 'pan'
}

/** A card the beat draws. Numbers are keys into brief.numbers (its `key`, else its `on_screen`). */
export type TimelineCard =
  | { kind: 'text'; text: string; eyebrow?: string; tone?: 'plain' | 'payoff' }
  | {
      kind: 'number'
      number: string
      /** Small capitals over the figure. Default: the row's geography, and the segment when its trace is single-family. */
      eyebrow?: string
      /** Display words under the figure ("months of homes for sale"). */
      unit?: string
      /** One footer line on what the figure measures (RULEBOOK §3). The as-of date from the trace follows it. */
      footer?: string
    }
  | { kind: 'question'; text: string }
  | { kind: 'turn'; text: string }

/** The picture device a beat carries: a registry scene technique and its params. */
export type TimelineScene = {
  kind: 'meter_fill_verdict'
  /** The brief.numbers key of a months-of-supply figure. */
  number: string
  eyebrow?: string
  /**
   * false: the meter drops its big value row and the marker carries the
   * reading against the 4 and 6 month marks (use it when the hook card has
   * just shown the figure). Default true.
   */
  show_value?: boolean
}

export type TimelineBeat = {
  id: string
  role: TimelineRole
  start: number
  end: number
  /** Legacy: the beat's line. Drawn as a text card only when the beat has no `cards` and no `scene`. */
  text?: string
  /** Legacy: the beat's figure as shown. Drawn as a number card only when the beat has no `cards` and no `scene`. */
  number?: string
  /** Legacy: planned text boxes for video_gate's safe-area check. Not drawn. */
  boxes?: Array<{ label?: string; x: number; y: number; w: number; h: number }>
  footage?: TimelineFootage
  scene?: TimelineScene
  cards?: TimelineCard[]
}

export type TimelineVoice = {
  /** The ElevenLabs v3 markup, exactly as sent (audio tags, ellipses, CAPS). Numbers spelled out. */
  script: string
  /** A female voice from the environment (lib/studio/voice VOICE_ENV). */
  voice: 'ellen' | 'victoria'
  /** Spoken phrase -> the on-screen figure the captions may show (buildCaptions `display`). */
  display?: Record<string, string>
  /** Seconds into the film where the voice's first sample plays. Default 0.3. */
  start?: number
  /** Default eleven_v3. */
  model?: string
  /** ElevenLabs seed, best-effort determinism. */
  seed?: number
  settings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number }
}

export type TimelineCta = {
  /** The share or topic line, its own card. */
  text: string
  start: number
  end: number
  /** 'send_invite' is the technique send_invite_hook (a share line). Default 'send_invite'. */
  kind?: 'send_invite' | 'plain'
  footage?: TimelineFootage
}

export type Timeline = {
  /** Legacy: the film's planned length, for video_gate. */
  duration_s?: number
  /** Must be 30 when present. */
  fps?: number
  /** Legacy: the planned loop seam, for video_gate. */
  loop_seam?: string
  beats: TimelineBeat[]
  voice?: TimelineVoice
  cta?: TimelineCta
  /** The code-composed score's mood. Absent: no score (a voice alone, or silence). */
  score?: 'calm' | 'measured'
}

export type BriefNumber = {
  /** A short id the timeline refers to. Optional; `on_screen` also works as the key. */
  key?: string
  on_screen: string
  value?: unknown
  definition: string
  window: string
  geography: string
  property_type?: string
  source: string
  hero?: boolean
  /** The DAL's own citation for the figure, verbatim (table, column, filter, fetched_at, computed_at). */
  citation?: Record<string, unknown>
}

/** The parts of a ryan-studio brief the renderer reads. Everything else passes through untouched. */
export type StudioBrief = {
  video_type: string
  title: string
  techniques: string[]
  numbers: BriefNumber[]
  hook?: { text?: string; time_s?: number }
  length_s?: number
  length_reason?: string
  spec_rules?: {
    loopable?: boolean
    voiceover?: { engine?: string; script?: string; voice?: string }
    topic_cta?: { text?: string; placement?: string }
  }
  [key: string]: unknown
}
