'use client'

import { useEffect, useState } from 'react'
import { TESTIMONIALS } from '@/lib/testimonials'
import { cn } from '@/lib/utils'

type Props = {
  /**
   * Color register. `dark` = light text for a navy/photo background.
   * `light` = navy text for a cream background (the "Who you'll talk to" band).
   * Defaults to `dark` for backward compatibility.
   */
  tone?: 'dark' | 'light'
  /**
   * Text alignment. `center` centers the rating row + quote (for the centered
   * "trusted team" block beneath the broker photos). Defaults to `left`.
   */
  align?: 'left' | 'center'
  /**
   * Scale. `lg` enlarges the quote and widens the block to span the broker
   * photos in the trusted-team section. Defaults to `sm`.
   */
  size?: 'sm' | 'lg'
}

/**
 * Fading real-review social proof for the seller LP. Animated gold stars
 * (text-warning token, twinkle wave) + a real review that fades through the
 * set. Every review is real (lib/testimonials.ts, pulled from the Ryan Realty
 * Google Business Profile). Respects prefers-reduced-motion.
 *
 * Two color registers via the `tone` prop so the same component reads on the
 * dark hero photo (light text) and on the cream team band (navy text).
 */
export default function SellerSocialProof({ tone = 'dark', align = 'left', size = 'sm' }: Props) {
  const [i, setI] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (TESTIMONIALS.length <= 1) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const id = setInterval(() => {
      if (reduce) {
        setI((p) => (p + 1) % TESTIMONIALS.length)
        return
      }
      setVisible(false)
      setTimeout(() => {
        setI((p) => (p + 1) % TESTIMONIALS.length)
        setVisible(true)
      }, 500)
    }, 6000)
    return () => clearInterval(id)
  }, [])

  const t = TESTIMONIALS[i]
  if (t === undefined) return null

  const isLight = tone === 'light'
  const centered = align === 'center'
  const large = size === 'lg'

  return (
    <div className={cn(large ? 'max-w-3xl' : 'max-w-md', centered && 'mx-auto text-center')}>
      <div
        className={cn('flex items-center gap-1.5', centered && 'justify-center')}
        role="img"
        aria-label="Rated five out of five stars"
      >
        {[0, 1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={cn('lp-star leading-none text-warning', large ? 'text-4xl sm:text-5xl' : 'text-2xl')}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </div>
      <blockquote
        className={cn('transition-opacity duration-500', large ? 'mt-4' : 'mt-2', visible ? 'opacity-100' : 'opacity-0')}
      >
        <p
          className={cn(
            'line-clamp-3 italic leading-relaxed',
            large ? 'text-lg sm:text-xl' : 'text-sm',
            isLight ? 'text-foreground/85' : 'text-card/90',
          )}
        >
          “{t.quote}”
        </p>
        <footer
          className={cn(
            'not-italic',
            large ? 'mt-3 text-sm' : 'mt-1 text-xs',
            isLight ? 'text-muted-foreground' : 'text-card/70',
          )}
        >
          {t.author}, {t.source} review
        </footer>
      </blockquote>
    </div>
  )
}
