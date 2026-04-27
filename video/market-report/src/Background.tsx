import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import { NAVY, NAVY_DEEP, NAVY_RICH, GOLD, GOLD_SOFT, CREAM, FPS } from './brand'

type Variant = 'navy' | 'navy-rich' | 'gold-tint' | 'cream' | 'navy-radial'

export const Background: React.FC<{ variant?: Variant; accentSide?: 'left' | 'right' }> = ({
  variant = 'navy',
  accentSide = 'right',
}) => {
  const frame = useCurrentFrame()
  // Subtle drift on radial highlight to add life w/o photo content
  const driftX = interpolate(frame, [0, FPS * 8], [0, 30], { extrapolateRight: 'clamp' })
  const driftY = interpolate(frame, [0, FPS * 8], [0, -20], { extrapolateRight: 'clamp' })

  const palettes: Record<Variant, { bg: string; accent: string; highlightColor: string; highlightOp: number }> = {
    navy: { bg: NAVY, accent: GOLD, highlightColor: NAVY_RICH, highlightOp: 0.55 },
    'navy-rich': { bg: NAVY_RICH, accent: GOLD, highlightColor: NAVY, highlightOp: 0.7 },
    'gold-tint': { bg: NAVY, accent: GOLD, highlightColor: GOLD_SOFT, highlightOp: 0.18 },
    cream: { bg: CREAM, accent: NAVY, highlightColor: GOLD_SOFT, highlightOp: 0.35 },
    'navy-radial': { bg: NAVY_DEEP, accent: GOLD, highlightColor: NAVY, highlightOp: 0.85 },
  }
  const p = palettes[variant]

  const radialX = accentSide === 'left' ? 25 + driftX * 0.05 : 75 - driftX * 0.05
  const radialY = 35 + driftY * 0.05

  return (
    <AbsoluteFill style={{ backgroundColor: p.bg }}>
      {/* Soft radial highlight to shape light without a photo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 50% at ${radialX}% ${radialY}%, ${p.highlightColor} 0%, transparent 70%)`,
          opacity: p.highlightOp,
          mixBlendMode: 'screen',
        }}
      />
      {/* Top-left fine line accent */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 90,
          width: 200,
          height: 3,
          background: p.accent,
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 90,
          width: 60,
          height: 3,
          background: p.accent,
          opacity: 0.85,
        }}
      />
      {/* Bottom rule */}
      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: 90,
          right: 90,
          height: 1,
          background: 'rgba(255,255,255,0.10)',
        }}
      />
      {/* Subtle grain via repeating dot grid (no external assets) */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.4,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  )
}
