import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREAM, FONT_HEAD, GOLD, NAVY_DEEP, WHITE } from '../brand'

type Props = {
  illustrationPath: string
  title: string
  durationInFrames: number
}

/**
 * IntroBeat — title card. Layout:
 *
 *   y    0 – 220   eyebrow text "AN EVERGREEN PRIMER"
 *   y  240 – 1000  illustration zone (760px tall)
 *   y 1040 – 1380  title (Amboqia, navy on cream pill)
 *   y 1480 – 1720  caption safe zone (empty for intro)
 */
export const IntroBeat: React.FC<Props> = ({ illustrationPath, durationInFrames }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const pushScale = interpolate(frame, [0, durationInFrames], [1.0, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const eyebrowOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const titleEnter = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 90 },
  })
  const titleOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {/* Eyebrow */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: GOLD,
          fontFamily: FONT_HEAD,
          fontSize: 32,
          letterSpacing: 8,
          opacity: 0.7 * eyebrowOpacity,
        }}
      >
        AN EVERGREEN PRIMER
      </div>

      {/* Illustration — cream backing panel for visual consistency */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 800,
            height: 800,
            background: CREAM,
            borderRadius: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
            border: `2px solid ${GOLD}`,
            overflow: 'hidden',
            transform: `scale(${pushScale})`,
            transformOrigin: 'center',
          }}
        >
          <Img
            src={staticFile(illustrationPath)}
            style={{
              width: 760,
              height: 760,
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 1100,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleEnter) * 24}px)`,
        }}
      >
        <div
          style={{
            color: CREAM,
            fontFamily: FONT_HEAD,
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: 1,
            padding: '0 80px',
            textShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          The 4 Pillars of
        </div>
        <div
          style={{
            color: GOLD,
            fontFamily: FONT_HEAD,
            fontSize: 96,
            lineHeight: 1.05,
            letterSpacing: 1,
            padding: '0 80px',
            textShadow: '0 8px 32px rgba(0,0,0,0.6)',
            marginTop: 12,
          }}
        >
          Real Estate Wealth
        </div>
      </div>
    </AbsoluteFill>
  )
}
