import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { CREAM, FONT_HEAD, GOLD, NAVY_DEEP } from '../brand'

type Props = {
  illustrationPath: string
  videoOverlayPath?: string | null
  tagline: string
  durationInFrames: number
}

/**
 * OutroBeat — closing tagline over hero bookend.
 *
 *   y  120 – 880   illustration
 *   y  920 – 1240  tagline (italic Amboqia)
 *   y 1320 – 1340  gold accent bar
 *   y 1480 – 1720  caption safe zone (empty)
 */
export const OutroBeat: React.FC<Props> = ({
  illustrationPath,
  videoOverlayPath,
  tagline,
  durationInFrames,
}) => {
  const frame = useCurrentFrame()

  const taglineOpacity = interpolate(
    frame,
    [0, 14, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0.92],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {/* Hero illustration — cream backing panel for visual consistency */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 760,
            height: 760,
            background: CREAM,
            borderRadius: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
            border: `2px solid ${GOLD}`,
            overflow: 'hidden',
          }}
        >
          {videoOverlayPath ? (
            <OffthreadVideo
              src={staticFile(videoOverlayPath)}
              style={{
                width: 720,
                height: 720,
                objectFit: 'contain',
              }}
              muted
            />
          ) : (
            <Img
              src={staticFile(illustrationPath)}
              style={{
                width: 720,
                height: 720,
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          top: 950,
          left: 80,
          right: 80,
          textAlign: 'center',
          color: CREAM,
          fontFamily: FONT_HEAD,
          fontStyle: 'italic',
          fontSize: 56,
          lineHeight: 1.25,
          opacity: taglineOpacity,
          textShadow: '0 6px 20px rgba(0,0,0,0.6)',
        }}
      >
        {tagline}
      </div>

      {/* Gold accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 1310,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 160,
          height: 3,
          background: GOLD,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  )
}
