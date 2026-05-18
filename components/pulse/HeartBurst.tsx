'use client'

import { useEffect, useState } from 'react'

type Burst = { id: number; x: number; y: number }

type Props = {
  burst: { x: number; y: number } | null
  /** Called once the animation completes so the parent can clear the trigger. */
  onComplete?: () => void
}

let nextId = 0

/**
 * Heart + particle burst that Instagram-style explodes at the tap point.
 * Honors prefers-reduced-motion (renders a static heart fade instead).
 */
export default function HeartBurst({ burst, onComplete }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    if (!burst) return
    const id = ++nextId
    setBursts((prev) => [...prev, { id, x: burst.x, y: burst.y }])
    const t = window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id))
      onComplete?.()
    }, 720)
    return () => window.clearTimeout(t)
  }, [burst, onComplete])

  return (
    <>
      {bursts.map((b) => (
        <div
          key={b.id}
          aria-hidden
          className="pointer-events-none absolute z-30 motion-safe:animate-[pulseHeart_640ms_cubic-bezier(0.34,1.56,0.64,1)_forwards] motion-reduce:animate-[pulseHeartReduced_300ms_ease-out_forwards]"
          style={{ left: b.x - 56, top: b.y - 56, width: 112, height: 112 }}
        >
          <svg viewBox="0 0 24 24" width="112" height="112" className="drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
            <path
              d="M12 21s-7.5-4.6-9.5-9.1C1 8.6 3.3 5.2 6.6 5.2c2 0 3.5 1 4.4 2.4l1 1.5 1-1.5C13.9 6.2 15.4 5.2 17.4 5.2c3.3 0 5.6 3.4 4.1 6.7C19.5 16.4 12 21 12 21z"
              fill="rgba(255,255,255,0.97)"
            />
          </svg>
          <div className="absolute inset-0 motion-reduce:hidden">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2
              const dx = Math.cos(angle) * 76
              const dy = Math.sin(angle) * 76
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-white/95 motion-safe:animate-[pulseHeartParticle_720ms_ease-out_forwards]"
                  style={{
                    // CSS variables consumed by the keyframe
                    ['--dx' as string]: `${dx}px`,
                    ['--dy' as string]: `${dy}px`,
                  } as React.CSSProperties}
                />
              )
            })}
          </div>
        </div>
      ))}
      <style jsx global>{`
        @keyframes pulseHeart {
          0%   { opacity: 0; transform: scale(0.2); }
          35%  { opacity: 1; transform: scale(1.4); }
          70%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes pulseHeartReduced {
          0%   { opacity: 0; transform: scale(0.9); }
          50%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes pulseHeartParticle {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          20%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.6);
          }
        }
      `}</style>
    </>
  )
}
