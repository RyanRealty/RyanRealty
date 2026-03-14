'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = {
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys?: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

export default function AffordabilityRow({
  listings,
  savedKeys,
  likedKeys = [],
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
}: Props) {
  const [targetPrice, setTargetPrice] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const targetNum = targetPrice.trim() === '' ? null : parseInt(targetPrice.replace(/\D/g, ''), 10)
  const affordable =
    targetNum != null && targetNum > 0
      ? listings.filter((l) => Number(l.ListPrice ?? 0) <= targetNum && Number(l.ListPrice ?? 0) > 0)
      : []

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.85
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
    setTimeout(updateScrollState, 300)
  }

  useEffect(() => {
    updateScrollState()
  }, [affordable.length])

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="affordability-heading">
      <h2 id="affordability-heading" className="text-xl font-bold tracking-tight text-foreground">
        Affordability
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your target price to see homes you can afford. Est. monthly payment uses{' '}
        <Link href="/account/buying-preferences" className="font-medium text-success hover:underline">
          your saved rate &amp; down payment
        </Link>.
      </p>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="mt-4 flex gap-4 overflow-x-auto pb-2 scroll-smooth"
      >
        {/* First tile: target price input — max 3 visible site-wide */}
        <div className="w-[85vw] min-w-[260px] max-w-[320px] shrink-0 sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]">
          <div className="flex h-full flex-col justify-center rounded-lg border-2 border-dashed border-border bg-muted p-6">
            <Label htmlFor="affordability-target-price" className="text-sm font-medium text-muted-foreground">
              Your target price
            </Label>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <Input
                id="affordability-target-price"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 500000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value.replace(/\D/g, ''))}
                className="w-full"
              />
            </div>
            {targetNum != null && targetNum > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Est. {formatMonthlyPayment(estimatedMonthlyPayment(targetNum, downPaymentPercent, interestRate, loanTermYears))}/mo
                at {interestRate}% for {loanTermYears} years
              </p>
            )}
          </div>
        </div>

        {affordable.length > 0 && (
          <>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-40"
                aria-label="Scroll left"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
              </Button>
            </div>
            {affordable.map((listing) => {
              const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
              const price = Number(listing.ListPrice ?? 0)
              const monthly =
                price > 0
                  ? estimatedMonthlyPayment(price, downPaymentPercent, interestRate, loanTermYears)
                  : null
              const monthlyPayment =
                monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
              return (
                <div key={key} className="w-[85vw] min-w-[260px] max-w-[320px] shrink-0 sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]">
                  <HomeTileCard
                    listing={listing}
                    listingKey={key}
                    monthlyPayment={monthlyPayment}
                    saved={signedIn ? savedKeys.includes(key) : undefined}
                    liked={signedIn ? likedKeys.includes(key) : undefined}
                    signedIn={signedIn}
                    userEmail={userEmail}
                  />
                </div>
              )
            })}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-40"
                aria-label="Scroll right"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}
      </div>
      {targetNum != null && targetNum > 0 && affordable.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No listings at or below ${targetNum.toLocaleString()} in this set.</p>
      )}
    </section>
  )
}
