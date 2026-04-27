import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Background } from './Background'
import { ImageLayer } from './ImageLayer'
import { FONT_BODY, FONT_HEAD, GOLD, WHITE, WHITE_SOFT } from './brand'

export const OutroBeat: React.FC<{
  city: string
  imageSrc?: string
  durationInFrames?: number
}> = ({ city, imageSrc, durationInFrames = 180 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logoIn = spring({ frame, fps, config: { damping: 20, stiffness: 110 } })
  const logoOp = interpolate(logoIn, [0, 1], [0, 1])
  const logoScale = interpolate(logoIn, [0, 1], [0.8, 1])
  const ctaPulse = interpolate(frame % 60, [0, 30, 60], [1, 1.04, 1])
  const ctaOp = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' })
  const ctaY = interpolate(frame, [80, 110], [30, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  const lineOp = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      {/* Image background — fallback to radial gradient */}
      {imageSrc ? (
        <ImageLayer src={imageSrc} durationInFrames={durationInFrames} direction="up" />
      ) : (
        <Background variant="navy-radial" accentSide="left" />
      )}

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 90px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
          transform: 'translateY(-100px)',
        }}>
          {/* White stacked logo — staticFile path resolves from public/ */}
          <div style={{ opacity: logoOp, transform: `scale(${logoScale})` }}>
            <Img
              src={staticFile('stacked_logo_white.png')}
              style={{ width: 280, height: 'auto', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
            />
          </div>
          <div style={{ width: 220, height: 3, background: GOLD, opacity: lineOp, marginTop: 4 }} />
          <div style={{
            color: WHITE, fontFamily: FONT_HEAD, fontSize: 96, lineHeight: 1.0,
            letterSpacing: -1, textAlign: 'center', opacity: lineOp,
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            {city} report
          </div>
          <div style={{
            color: WHITE_SOFT, fontFamily: FONT_BODY, fontSize: 30, letterSpacing: 6,
            textTransform: 'uppercase', opacity: lineOp, fontWeight: 600,
          }}>
            Sourced direct from MLS · YTD 2026
          </div>
        </div>

        {/* CTA block — final 15% reveal */}
        <div style={{
          position: 'absolute', bottom: 200, left: 90, right: 90,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          opacity: ctaOp, transform: `translateY(${ctaY}px)`,
        }}>
          <div style={{
            padding: '22px 48px', borderRadius: 999, background: GOLD, color: '#102742',
            fontFamily: FONT_BODY, fontSize: 36, fontWeight: 800, letterSpacing: 2,
            transform: `scale(${ctaPulse})`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            Full report at ryan-realty.com
          </div>
          <div style={{
            color: WHITE_SOFT, fontFamily: FONT_BODY, fontSize: 26,
            letterSpacing: 4, textTransform: 'uppercase', marginTop: 8,
          }}>
            Subscribe for monthly updates
          </div>
        </div>

        {/* Photo credit — bottom-right, small */}
        {imageSrc ? (
          <div style={{
            position: 'absolute', bottom: 130, right: 90,
            color: 'rgba(255,255,255,0.45)', fontFamily: FONT_BODY, fontSize: 18,
            letterSpacing: 1,
          }}>
            Photos: Unsplash
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
