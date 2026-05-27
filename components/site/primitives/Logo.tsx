import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Logo / RyanRealtyMark / JaxMascot — typed wrappers around the
 * canonical brand assets in `/public/brand/` so consumer components
 * stop referencing raw `/logo-header-white.png`-style paths.
 *
 * Source of truth: `design_system/ryan-realty/assets/brand/` →
 * mirrored to `/public/brand/` as part of this commit.
 *
 * Variants:
 *
 *   <RyanRealtyMark variant="horizontal" tone="white" />  — sticky nav, navy bg
 *   <RyanRealtyMark variant="horizontal" tone="navy" />   — on cream background
 *   <RyanRealtyMark variant="stacked" tone="navy" />      — print, signage, large card hero
 *   <RyanRealtyMark variant="stacked" tone="white" />     — listing video footer bar
 *
 *   <JaxMascot tone="navy" />   — primary brand-led content (light backgrounds)
 *   <JaxMascot tone="white" />  — dark backgrounds (hero overlays, navy panels)
 *
 * `Logo` is an alias for `RyanRealtyMark` for backward compatibility +
 * brevity in consumer code.
 */

type Tone = 'navy' | 'white'

// ─── RyanRealtyMark (wordmark) ────────────────────────────────────────

type WordmarkProps = {
  /** Horizontal (the default 5.7:1 lockup) or stacked (1.5:1 — print). */
  variant?: 'horizontal' | 'stacked'
  tone?: Tone
  /** Width in pixels at the rendered size; height auto-scales. */
  width?: number
  /** Accessible name. Defaults to "Ryan Realty". */
  alt?: string
  /** When true, mark as the LCP element + preload. Use for site-header logo. */
  priority?: boolean
  className?: string
}

const WORDMARK_SRC: Record<`${'horizontal' | 'stacked'}-${Tone}`, string> = {
  'horizontal-navy': '/brand/wordmark-navy.png',
  'horizontal-white': '/brand/wordmark-white.png',
  'stacked-navy': '/brand/wordmark-stacked-navy.png',
  'stacked-white': '/brand/wordmark-stacked-white.png',
}

const WORDMARK_INTRINSIC = {
  horizontal: { width: 959, height: 629 },
  stacked: { width: 959, height: 629 },
} as const

export function RyanRealtyMark({
  variant = 'horizontal',
  tone = 'navy',
  width = 180,
  alt = 'Ryan Realty',
  priority = false,
  className,
}: WordmarkProps) {
  const src = WORDMARK_SRC[`${variant}-${tone}`]
  const intrinsic = WORDMARK_INTRINSIC[variant]
  const height = Math.round((width * intrinsic.height) / intrinsic.width)
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn('select-none', className)}
    />
  )
}

/** Alias for `RyanRealtyMark` — convenience for shorter consumer code. */
export const Logo = RyanRealtyMark

// ─── JaxMascot ────────────────────────────────────────────────────────

type JaxProps = {
  tone?: Tone
  /** Pixel width; the asset is square so height = width. */
  size?: number
  alt?: string
  className?: string
}

const JAX_SRC: Record<Tone, string> = {
  navy: '/brand/jax-navy.png',
  white: '/brand/jax-white.png',
}

export function JaxMascot({
  tone = 'navy',
  size = 48,
  alt = 'Jax, the Ryan Realty mascot',
  className,
}: JaxProps) {
  return (
    <Image
      src={JAX_SRC[tone]}
      alt={alt}
      width={size}
      height={size}
      className={cn('select-none', className)}
    />
  )
}
