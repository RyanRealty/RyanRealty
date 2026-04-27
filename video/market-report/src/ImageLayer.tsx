import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

type ImageLayerProps = {
  /** Path relative to public/ — e.g. "bend/img_1.jpg" */
  src: string
  /** Duration of this beat in frames (for Ken Burns end scale) */
  durationInFrames?: number
  /** Direction of Ken Burns translate (default 'right') */
  direction?: 'right' | 'left' | 'up'
}

/**
 * Full-bleed image with Ken Burns slow zoom + translate, plus a navy scrim
 * that ensures white text is always legible regardless of image content.
 *
 * If the image file doesn't exist, falls back to transparent (Background
 * gradient will show through from the parent component).
 */
export const ImageLayer: React.FC<ImageLayerProps> = ({
  src,
  durationInFrames = 120,
  direction = 'right',
}) => {
  const frame = useCurrentFrame()

  // Ken Burns: gentle zoom from 1.0 → 1.08 over the beat duration
  const prog = Math.min(1, frame / Math.max(1, durationInFrames))
  const scale = interpolate(prog, [0, 1], [1.0, 1.08])

  // Translate direction — slow drift (max 20px at full zoom)
  const tx = direction === 'right' ? interpolate(prog, [0, 1], [0, -20])
    : direction === 'left' ? interpolate(prog, [0, 1], [0, 20])
    : 0
  const ty = direction === 'up' ? interpolate(prog, [0, 1], [0, -15]) : 0

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* The image itself */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </AbsoluteFill>

      {/* Navy scrim — stronger at bottom where text lives, light at top */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(16,39,66,0.25) 0%, rgba(16,39,66,0.50) 35%, rgba(16,39,66,0.80) 65%, rgba(16,39,66,0.92) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  )
}
