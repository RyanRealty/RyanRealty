import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CAPTION_Y_BOTTOM, CAPTION_Y_TOP, FONT_BODY, GOLD, NAVY } from './brand'

export type CaptionWord = { text: string; startSec: number; endSec: number }

// Caption band lives at y 1480-1720 (per spec — never overlaps stat content above).
// Renders the active "phrase" (active word + ~3 surrounding words for context),
// active word in gold, others in white. Soft pill background ensures contrast.
export const CaptionBand: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  // Find current word
  const activeIdx = words.findIndex(w => t >= w.startSec && t < w.endSec)
  if (activeIdx === -1) return null

  // Build phrase window: 3 words before, active, 3 words after (clamped)
  const start = Math.max(0, activeIdx - 3)
  const end = Math.min(words.length, activeIdx + 4)
  const phrase = words.slice(start, end)
  const activeInPhrase = activeIdx - start

  // Soft fade in/out of band: ramp opacity for first/last 4 frames of each word
  const w = words[activeIdx]
  const fadeIn = interpolate(t, [w.startSec, w.startSec + 0.08], [0.4, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const fadeOut = interpolate(t, [w.endSec - 0.06, w.endSec], [1, 0.85], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const opacity = Math.min(fadeIn, fadeOut)

  return (
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
          padding: '22px 36px',
          borderRadius: 24,
          maxWidth: 960,
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          {phrase.map((pw, i) => (
            <span
              key={`${pw.startSec}-${i}`}
              style={{
                fontFamily: FONT_BODY,
                fontWeight: i === activeInPhrase ? 800 : 600,
                fontSize: 44,
                color: i === activeInPhrase ? GOLD : 'rgba(255,255,255,0.92)',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {pw.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
