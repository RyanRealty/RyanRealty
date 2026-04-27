import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Background } from './Background'
import { ImageLayer } from './ImageLayer'
import { FONT_BODY, FONT_HEAD, GOLD, NAVY, WHITE, WHITE_DIM, WHITE_SOFT } from './brand'

export type StatLayout = 'hero' | 'bar' | 'compare' | 'callout' | 'label-only'

export type StatBeatProps = {
  index: number
  total: number
  label: string
  value: string
  unit?: string
  context?: string
  changeText?: string // e.g. "↓ 7.3% YoY"
  changeDir?: 'up' | 'down' | 'flat'
  layout: StatLayout
  bgVariant: 'navy' | 'navy-rich' | 'gold-tint' | 'cream' | 'navy-radial'
  accentSide?: 'left' | 'right'
  barPct?: number
  pillText?: string
  /** Slug-based image source e.g. "bend/img_2.jpg" — from props injected at render time */
  imageSrc?: string
  durationInFrames?: number
}

export const StatBeat: React.FC<StatBeatProps> = ({
  index, total, label, value, unit, context, changeText, changeDir = 'flat',
  layout, bgVariant, accentSide = 'right', barPct = 0, pillText,
  imageSrc, durationInFrames = 120,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const intro = spring({ frame, fps, config: { damping: 18, stiffness: 120 } })
  const valueScale = interpolate(intro, [0, 1], [0.85, 1])
  const valueOp = interpolate(intro, [0, 1], [0, 1])
  const labelOp = interpolate(frame, [4, 14], [0, 1], { extrapolateRight: 'clamp' })
  const ctxOp = interpolate(frame, [16, 28], [0, 1], { extrapolateRight: 'clamp' })
  const lineW = interpolate(frame, [2, 28], [0, 220], { extrapolateRight: 'clamp' })
  const barFill = interpolate(frame, [12, 38], [0, Math.max(0, Math.min(1, barPct))], { extrapolateRight: 'clamp' })

  const cream = bgVariant === 'cream'
  const fg = cream ? NAVY : WHITE
  const fgSoft = cream ? 'rgba(16,39,66,0.78)' : WHITE_SOFT
  const fgDim = cream ? 'rgba(16,39,66,0.55)' : WHITE_DIM

  const arrow = changeDir === 'up' ? '↑' : changeDir === 'down' ? '↓' : '→'
  const changeColor = changeDir === 'up' ? '#7BD389' : changeDir === 'down' ? '#FF8B7E' : GOLD

  // Label-only beat — just the category name, big and centered.
  // Used as the "incoming" card before the value card for each stat.
  const renderLabelOnly = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
      transform: `translateY(${-60}px)`,
    }}>
      <div style={{ width: lineW, height: 3, background: GOLD }} />
      <div style={{
        color: fg, fontFamily: FONT_BODY, fontSize: 56, letterSpacing: 6,
        textTransform: 'uppercase', opacity: labelOp, fontWeight: 800, textAlign: 'center',
        maxWidth: 860, lineHeight: 1.2,
        textShadow: imageSrc ? '0 2px 16px rgba(0,0,0,0.7)' : 'none',
      }}>
        {label}
      </div>
      <div style={{ width: lineW * 0.6, height: 2, background: GOLD, opacity: 0.6 }} />
    </div>
  )

  // Hero stat number — extra-large
  const renderHero = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{
        color: GOLD, fontFamily: FONT_BODY, fontSize: 26, letterSpacing: 8,
        textTransform: 'uppercase', opacity: labelOp, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{ width: lineW, height: 3, background: GOLD }} />
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14,
        transform: `scale(${valueScale})`, opacity: valueOp,
      }}>
        <span style={{
          color: fg, fontFamily: FONT_HEAD, fontSize: 220, lineHeight: 0.92, letterSpacing: -3,
          textShadow: imageSrc ? '0 4px 24px rgba(0,0,0,0.65)' : 'none',
        }}>{value}</span>
        {unit ? <span style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 64, fontWeight: 700 }}>{unit}</span> : null}
      </div>
      {changeText ? (
        <div style={{
          marginTop: 8, padding: '10px 22px', borderRadius: 999,
          background: cream ? 'rgba(16,39,66,0.08)' : 'rgba(255,255,255,0.10)',
          border: `2px solid ${changeColor}`, color: changeColor,
          fontFamily: FONT_BODY, fontSize: 32, fontWeight: 700, opacity: ctxOp,
        }}>
          {arrow} {changeText}
        </div>
      ) : null}
      {context ? (
        <div style={{
          color: fgSoft, fontFamily: FONT_BODY, fontSize: 32, marginTop: 14,
          textAlign: 'center', maxWidth: 860, opacity: ctxOp,
        }}>
          {context}
        </div>
      ) : null}
    </div>
  )

  // Bar layout
  const renderBar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, width: 880 }}>
      <div style={{
        color: GOLD, fontFamily: FONT_BODY, fontSize: 26, letterSpacing: 8,
        textTransform: 'uppercase', opacity: labelOp, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12, opacity: valueOp }}>
        <span style={{
          color: fg, fontFamily: FONT_HEAD, fontSize: 200, lineHeight: 0.92, letterSpacing: -3,
          textShadow: imageSrc ? '0 4px 24px rgba(0,0,0,0.65)' : 'none',
        }}>{value}</span>
        {unit ? <span style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 56, fontWeight: 700 }}>{unit}</span> : null}
      </div>
      <div style={{
        width: '100%', height: 24,
        background: cream ? 'rgba(16,39,66,0.12)' : 'rgba(255,255,255,0.12)',
        borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${cream ? 'rgba(16,39,66,0.18)' : 'rgba(255,255,255,0.18)'}`,
      }}>
        <div style={{ width: `${barFill * 100}%`, height: '100%', background: GOLD, borderRadius: 12 }} />
      </div>
      {context ? (
        <div style={{
          color: fgSoft, fontFamily: FONT_BODY, fontSize: 30, textAlign: 'center',
          maxWidth: 880, opacity: ctxOp,
        }}>
          {context}
        </div>
      ) : null}
    </div>
  )

  // Compare
  const renderCompare = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{
        color: GOLD, fontFamily: FONT_BODY, fontSize: 26, letterSpacing: 8,
        textTransform: 'uppercase', opacity: labelOp, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{ width: lineW, height: 3, background: GOLD }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, opacity: valueOp }}>
        <span style={{
          color: fg, fontFamily: FONT_HEAD, fontSize: 196, lineHeight: 0.92, letterSpacing: -2,
          textShadow: imageSrc ? '0 4px 24px rgba(0,0,0,0.65)' : 'none',
        }}>{value}</span>
        {unit ? <span style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 52, fontWeight: 700 }}>{unit}</span> : null}
      </div>
      {changeText ? (
        <div style={{ color: changeColor, fontFamily: FONT_BODY, fontSize: 38, fontWeight: 700, opacity: ctxOp }}>
          {arrow} {changeText}
        </div>
      ) : null}
      {context ? (
        <div style={{
          color: fgSoft, fontFamily: FONT_BODY, fontSize: 30, marginTop: 6,
          textAlign: 'center', maxWidth: 860, opacity: ctxOp,
        }}>
          {context}
        </div>
      ) : null}
    </div>
  )

  // Callout — pill at top, big value
  const renderCallout = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {pillText ? (
        <div style={{
          padding: '14px 32px', borderRadius: 999, background: GOLD, color: NAVY,
          fontFamily: FONT_BODY, fontSize: 30, fontWeight: 800, letterSpacing: 4,
          textTransform: 'uppercase', opacity: labelOp,
        }}>
          {pillText}
        </div>
      ) : null}
      <div style={{
        color: GOLD, fontFamily: FONT_BODY, fontSize: 26, letterSpacing: 8,
        textTransform: 'uppercase', opacity: labelOp, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14, opacity: valueOp,
        transform: `scale(${valueScale})`,
      }}>
        <span style={{
          color: fg, fontFamily: FONT_HEAD, fontSize: 220, lineHeight: 0.92, letterSpacing: -3,
          textShadow: imageSrc ? '0 4px 24px rgba(0,0,0,0.65)' : 'none',
        }}>{value}</span>
        {unit ? <span style={{ color: GOLD, fontFamily: FONT_BODY, fontSize: 60, fontWeight: 700 }}>{unit}</span> : null}
      </div>
      {context ? (
        <div style={{
          color: fgSoft, fontFamily: FONT_BODY, fontSize: 32, marginTop: 6,
          textAlign: 'center', maxWidth: 860, opacity: ctxOp,
        }}>
          {context}
        </div>
      ) : null}
    </div>
  )

  return (
    <AbsoluteFill>
      {/* Image background — fallback to gradient if no image */}
      {imageSrc ? (
        <ImageLayer src={imageSrc} durationInFrames={durationInFrames} direction={index % 2 === 0 ? 'left' : 'right'} />
      ) : (
        <Background variant={bgVariant} accentSide={accentSide} />
      )}

      {/* Beat counter top-right */}
      <div style={{
        position: 'absolute', top: 80, right: 110,
        color: cream ? 'rgba(16,39,66,0.65)' : 'rgba(255,255,255,0.55)',
        fontFamily: FONT_BODY, fontSize: 22, letterSpacing: 4, fontWeight: 700,
      }}>
        {String(index).padStart(2, '0')} · {String(total).padStart(2, '0')}
      </div>

      {/* Top-left accent line */}
      <div style={{ position: 'absolute', top: 80, left: 90, width: 200, height: 3, background: GOLD, opacity: 0.85 }} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 90px', paddingBottom: 540 }}>
        {layout === 'label-only' && renderLabelOnly()}
        {layout === 'hero' && renderHero()}
        {layout === 'bar' && renderBar()}
        {layout === 'compare' && renderCompare()}
        {layout === 'callout' && renderCallout()}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
