import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CAPTION_Y_BOTTOM, CAPTION_Y_TOP, FONT_BODY, GOLD } from '../brand'

export type CaptionWord = { text: string; startSec: number; endSec: number }

export type CaptionSentence = {
  text: string
  startSec: number
  endSec: number
  words: CaptionWord[]
}

/**
 * CaptionBand — full-sentence captions with active-word highlight.
 *
 * Per CLAUDE.md §0.5 (HARD RULE — ship blocker):
 *   - Reserved safe zone: y 1480-1720, x 90-990
 *   - Active word color shift navy → gold + smooth fade
 *   - No other component renders into this zone
 *
 * Behavior change 2026-05-03 (Matt feedback): instead of a sliding 7-word
 * window that disappeared on word gaps and flashed at sentence boundaries,
 * the band now displays the FULL CURRENT SENTENCE for its entire duration
 * (including breath gaps between words) and highlights the spoken word
 * inside that sentence in gold.
 *
 * - Sentence stays up from its first word's startSec through the breath gap
 *   to the next sentence (precomputed in synth-vo.mjs as captionSentences).
 * - The active word is whichever word's [startSec, endSec] window contains t,
 *   OR the LAST word that started before t if we're inside a between-word gap
 *   (so the highlight lingers naturally instead of going dark mid-sentence).
 * - The band itself never goes dark mid-sentence. Soft fade in/out at sentence
 *   boundaries (8-frame ramp) prevents the old hard-flash issue.
 *
 * Backward-compat: if `sentences` prop is empty/missing, falls back to the
 * legacy sliding-window word display (preserves rendering of older builds).
 */
export const CaptionBand: React.FC<{
  words: CaptionWord[]
  sentences?: CaptionSentence[]
}> = ({ words, sentences }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  // Prefer sentence display when sentences provided
  if (sentences && sentences.length > 0) {
    return <SentenceBand sentences={sentences} t={t} fps={fps} />
  }

  // ---- Legacy sliding-window fallback (kept for old builds) ----
  const activeIdx = words.findIndex((w) => t >= w.startSec && t < w.endSec)
  if (activeIdx === -1) return null
  const start = Math.max(0, activeIdx - 3)
  const end = Math.min(words.length, activeIdx + 4)
  const phrase = words.slice(start, end)
  const activeInPhrase = activeIdx - start
  const w = words[activeIdx]
  const fadeIn = interpolate(t, [w.startSec, w.startSec + 0.08], [0.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(t, [w.endSec - 0.06, w.endSec], [1, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = Math.min(fadeIn, fadeOut)
  return (
    <BandShell opacity={opacity}>
      {phrase.map((pw, i) => (
        <Word key={`${pw.startSec}-${i}`} text={pw.text} active={i === activeInPhrase} />
      ))}
    </BandShell>
  )
}

const SentenceBand: React.FC<{ sentences: CaptionSentence[]; t: number; fps: number }> = ({ sentences, t }) => {
  const sIdx = sentences.findIndex((s) => t >= s.startSec && t < s.endSec)
  if (sIdx === -1) return null
  const sentence = sentences[sIdx]

  let activeWordIdx = -1
  for (let i = 0; i < sentence.words.length; i++) {
    const w = sentence.words[i]
    if (t >= w.startSec && t < w.endSec) {
      activeWordIdx = i
      break
    }
    if (t >= w.startSec) activeWordIdx = i
  }

  const fadeInEnd = Math.min(sentence.startSec + 0.25, sentence.endSec)
  const fadeOutStart = Math.max(sentence.endSec - 0.15, sentence.startSec)
  const fadeIn = interpolate(t, [sentence.startSec, fadeInEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(t, [fadeOutStart, sentence.endSec], [1, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = Math.min(fadeIn, fadeOut)

  // v3: auto-fit font size for long sentences (no mid-sentence break ever)
  const wc = sentence.words.length
  const fontSize = wc <= 14 ? 40 : wc <= 18 ? 36 : wc <= 24 ? 32 : 28

  return (
    <BandShell opacity={opacity}>
      {sentence.words.map((w, i) => (
        <Word key={`${w.startSec}-${i}`} text={w.text} active={i === activeWordIdx} fontSize={fontSize} />
      ))}
    </BandShell>
  )
}

const BandShell: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <div
    style={{
      position: 'absolute',
      left: 60,
      right: 60,
      top: CAPTION_Y_TOP,
      height: CAPTION_Y_BOTTOM - CAPTION_Y_TOP,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      opacity,
    }}
  >
    <div
      style={{
        background: 'rgba(10,26,46,0.88)',
        border: `2px solid ${GOLD}`,
        padding: '20px 32px',
        borderRadius: 24,
        maxWidth: 960,
        textAlign: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {children}
      </div>
    </div>
  </div>
)

const Word: React.FC<{ text: string; active: boolean; fontSize?: number }> = ({ text, active, fontSize = 40 }) => (
  <span
    style={{
      fontFamily: FONT_BODY,
      fontWeight: active ? 800 : 600,
      fontSize,
      color: active ? GOLD : 'rgba(255,255,255,0.92)',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      transition: 'color 80ms linear',
    }}
  >
    {text}
  </span>
)
