'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BrandCardDefinition } from '@/lib/pulse-brand-cards'
import { trackEvent } from '@/lib/tracking'

type Props = {
  card: BrandCardDefinition
  position?: number
}

/**
 * Native Ryan Realty card. Lives in the /pulse scroll alongside MLS events.
 * Same 9:16 frame, same overlay rhythm, but visually marked as Ryan Realty
 * content. Trust + lead capture in one card.
 *
 * Variant treatments:
 *  - "navy" tone: photo darkened with a navy gradient; content sits on cream
 *    text against a deep wash at the bottom. Used for valuation, broker
 *    spotlight, subscribe, featured video.
 *  - "cream" tone: cream/warm-stone bg with the Jax illustration; content
 *    sits in navy text on cream. Used for the "Our Story" trust card.
 */
export default function BrandCard({ card, position }: Props) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Producer-video brand cards autoplay when scrolled into view, pause out.
  useEffect(() => {
    if (!card.backgroundVideo) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const video = videoRef.current
        if (!video || !entry) return
        if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
          video.play().catch(() => undefined)
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.55, 1] }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [card.backgroundVideo])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!card.inlineEmail || !email.trim()) return
    setSubmitting(true)
    setStatus('idle')
    try {
      const eventId = `pulse-brand-${card.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const resp = await fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'Lead',
          email: email.trim(),
          eventId,
          customData: {
            content_name: card.inlineEmail.contentName,
            lead_type: 'pulse_brand_card',
            brand_card_id: card.id,
            value: card.inlineEmail.leadValue,
            currency: 'USD',
          },
        }),
      })
      if (!resp.ok) throw new Error(`signup failed (${resp.status})`)
      trackEvent('generate_lead', {
        source: 'pulse_brand_card',
        brand_card_id: card.id,
        position: position ?? null,
      })
      setStatus('ok')
    } catch {
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCtaClick() {
    trackEvent(card.cta.event, {
      source: 'pulse_brand_card',
      brand_card_id: card.id,
      brand_card_kind: card.kind,
      position: position ?? null,
    })
  }

  const isNavy = card.tone === 'navy'
  const isBrokerCard = card.kind === 'meet_broker'

  return (
    <article
      ref={containerRef}
      className="group relative isolate overflow-hidden rounded-2xl shadow-lg"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        className={cn(
          'relative aspect-[9/16] w-full',
          isNavy ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
        )}
      >
        {/* Background: producer video > broker headshot > photo */}
        {card.backgroundVideo ? (
          <video
            ref={videoRef}
            src={card.backgroundVideo}
            poster={card.backgroundImage}
            muted
            playsInline
            loop
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : isBrokerCard ? (
          // Broker portrait. The transparent PNG sits over a navy field so the cutout reads cleanly.
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-primary to-[#0a1a2e]" />
            <div className="absolute inset-x-0 top-0 h-[68%]">
              <Image
                src={card.backgroundImage}
                alt={card.backgroundAlt}
                fill
                sizes="(max-width: 640px) 100vw, 540px"
                className="object-cover object-[center_top]"
                priority={false}
              />
            </div>
          </>
        ) : (
          <Image
            src={card.backgroundImage}
            alt={card.backgroundAlt}
            fill
            sizes="(max-width: 640px) 100vw, 540px"
            className={cn(
              'object-cover',
              isNavy ? 'opacity-90' : 'opacity-70'
            )}
            priority={false}
          />
        )}

        {/* Tone wash — softened on video cards so the motion stays readable */}
        {!isBrokerCard && (
          isNavy ? (
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-b',
                card.backgroundVideo
                  ? 'from-primary/15 via-primary/35 to-primary/85'
                  : 'from-primary/40 via-primary/65 to-primary'
              )}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/75 to-background" />
          )
        )}

        {/* Top eyebrow + sponsored tag */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 sm:p-4">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
              isNavy
                ? 'bg-background text-foreground'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {card.kicker}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] backdrop-blur',
              isNavy
                ? 'bg-background/15 text-background'
                : 'bg-foreground/10 text-foreground'
            )}
          >
            Ryan Realty
          </span>
        </div>

        {/* Jax foreground only when defined (Our Story) */}
        {!isBrokerCard && card.foregroundImage && (
          <div className="pointer-events-none absolute inset-x-0 top-[12%] z-[1] h-[40%]">
            <Image
              src={card.foregroundImage}
              alt={card.foregroundAlt ?? ''}
              fill
              sizes="240px"
              className="object-contain"
            />
          </div>
        )}

        {/* Bottom content block — sits on the deep gradient so text stays readable on any photo */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-12 sm:px-6 sm:pb-6',
            isNavy ? 'text-background' : 'text-foreground'
          )}
        >
          <h3
            className={cn(
              'font-display leading-[1.04]',
              isBrokerCard ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
            )}
            style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
          >
            {card.headline}
          </h3>
          <p className={cn('mt-2 text-sm', isNavy ? 'text-background/90' : 'text-foreground/85')}>
            {card.body}
          </p>
          {card.secondaryBody && (
            <p className={cn('mt-1 text-xs leading-snug', isNavy ? 'text-background/70' : 'text-foreground/65')}>
              {card.secondaryBody}
            </p>
          )}

          {card.inlineEmail ? (
            status === 'ok' ? (
              <p
                className={cn(
                  'mt-4 rounded-lg border px-3 py-2 text-sm',
                  isNavy
                    ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-50'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                )}
              >
                Got it. Watch your inbox for the next report.
              </p>
            ) : (
              <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={card.inlineEmail.placeholder}
                  required
                  disabled={submitting}
                  className={cn(
                    'flex-1',
                    isNavy
                      ? 'border-background/30 bg-background/15 text-background placeholder:text-background/60 focus-visible:ring-background/40'
                      : 'border-foreground/20 bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary'
                  )}
                />
                <Button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className={cn(
                    isNavy
                      ? 'bg-background text-foreground hover:bg-background/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {submitting ? 'Sending…' : card.inlineEmail.submitLabel}
                </Button>
              </form>
            )
          ) : (
            <Link
              href={card.cta.href}
              onClick={handleCtaClick}
              className={cn(
                'mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2',
                isNavy
                  ? 'bg-background text-foreground hover:bg-background/90 focus-visible:ring-background/40'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40'
              )}
            >
              {card.cta.label}
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
            </Link>
          )}
          {status === 'error' && card.inlineEmail && (
            <p
              className={cn(
                'mt-2 text-xs',
                isNavy ? 'text-rose-200' : 'text-rose-700'
              )}
            >
              We could not send that. Try again in a moment.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
