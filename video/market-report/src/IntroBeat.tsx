import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Background } from './Background'
import { ImageLayer } from './ImageLayer'
import { FONT_BODY, FONT_HEAD, GOLD, WHITE, WHITE_SOFT } from './brand'

export const IntroBeat: React.FC<{
  city: string
  period: string
  subhead: string
  citySlug?: string
  durationInFrames?: number
}> = ({ city, period, subhead, citySlug, durationInFrames = 120 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleProg = spring({ frame, fps, config: { damping: 16, stiffness: 110 } })
  const titleY = interpolate(titleProg, [0, 1], [40, 0])
  const titleOp = interpolate(titleProg, [0, 1], [0, 1])
  const subOp = interpolate(frame, [12, 24], [0, 1], { extrapolateRight: 'clamp' })
  const periodOp = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: 'clamp' })
  const lineWidth = interpolate(frame, [4, 30], [0, 220], { extrapolateRight: 'clamp' })

  const imgSrc = citySlug ? `${citySlug}/img_1.jpg` : null

  return (
    <AbsoluteFill>
      {/* Image background — fallback to gradient if no image */}
      {imgSrc ? (
        <ImageLayer src={imgSrc} durationInFrames={durationInFrames} direction="right" />
      ) : (
        <Background variant="navy" accentSide="right" />
      )}

      {/* Top accent lines (decorative — always visible) */}
      <div style={{ position: 'absolute', top: 80, left: 90, width: 200, height: 3, background: GOLD, opacity: 0.85 }} />
      <div style={{ position: 'absolute', top: 80, right: 90, width: 60, height: 3, background: GOLD, opacity: 0.85 }} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 90px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26,
          transform: `translateY(${-120}px)`,
        }}>
          {/* Eyebrow */}
          <div style={{
            color: GOLD, fontFamily: FONT_BODY, fontSize: 26, letterSpacing: 10,
            textTransform: 'uppercase', opacity: subOp, fontWeight: 700,
          }}>
            Central Oregon
          </div>

          {/* Gold rule */}
          <div style={{ width: lineWidth, height: 3, background: GOLD, opacity: 0.95 }} />

          {/* City name */}
          <div style={{
            color: WHITE,
            fontFamily: FONT_HEAD,
            fontSize: 168,
            lineHeight: 0.95,
            letterSpacing: -2,
            transform: `translateY(${titleY}px)`,
            opacity: titleOp,
            textAlign: 'center',
            textShadow: '0 4px 32px rgba(0,0,0,0.6)',
          }}>
            {city}
          </div>

          {/* Subhead: "YTD Market Report April 2026" */}
          <div style={{
            color: WHITE_SOFT, fontFamily: FONT_BODY, fontSize: 38, fontWeight: 500,
            opacity: periodOp, textAlign: 'center', maxWidth: 880, marginTop: 10,
          }}>
            {subhead}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
