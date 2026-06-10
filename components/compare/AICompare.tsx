'use client'

import { useState, useTransition } from 'react'
import { trackEvent } from '@/lib/tracking'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ComparisonListing = {
  listingKey: string
  address: string
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  lotAcres: number | null
  dom: number | null
  pricePerSqft: number | null
  city: string | null
  subdivision: string | null
}

type Props = {
  listings: ComparisonListing[]
  className?: string
}

/**
 * AICompare — AI-powered property comparison tool.
 *
 * Takes 2-3 listings and generates a natural language comparison
 * highlighting pros, cons, and recommendations based on the data.
 *
 * Uses the AI chat API endpoint to generate the analysis.
 */
export default function AICompare({ listings, className }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (listings.length < 2) return null

  function generateComparison() {
    trackEvent('ai_compare_used', { listing_count: listings.length })
    startTransition(async () => {
      try {
        const prompt = buildComparisonPrompt(listings)

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        if (!res.ok) {
          setAnalysis('Unable to generate comparison at this time. Please try again later.')
          return
        }

        const data = await res.json()
        setAnalysis(data.message ?? 'No analysis available.')
      } catch {
        setAnalysis('Unable to generate comparison. Please try again.')
      }
    })
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Property Analysis</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compare {listings.length} properties with AI-powered insights
            </p>
          </div>
          {!analysis && (
            <Button
              onClick={generateComparison}
              disabled={isPending}
              size="sm"
            >
              {isPending ? 'Analyzing...' : 'Compare with AI'}
            </Button>
          )}
        </div>

        {isPending && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {analysis && (
          <div className="mt-4">
            <div className="prose prose-sm max-w-none text-foreground">
              {analysis.split('\n').map((line, i) => (
                <p key={i} className={cn('text-sm', line.startsWith('**') ? 'font-semibold' : 'text-muted-foreground')}>
                  {line}
                </p>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => { setAnalysis(null); generateComparison() }}
            >
              Regenerate analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildComparisonPrompt(listings: ComparisonListing[]): string {
  const descriptions = listings.map((l, i) => {
    const details = [
      `Price: $${l.price.toLocaleString()}`,
      l.beds != null ? `${l.beds} bed` : null,
      l.baths != null ? `${l.baths} bath` : null,
      l.sqft != null ? `${l.sqft.toLocaleString()} sqft` : null,
      l.yearBuilt != null ? `Built ${l.yearBuilt}` : null,
      l.lotAcres != null ? `${l.lotAcres} acres` : null,
      l.dom != null ? `${l.dom} days on market` : null,
      l.pricePerSqft != null ? `$${l.pricePerSqft}/sqft` : null,
      l.city ? `in ${l.city}` : null,
      l.subdivision ? `(${l.subdivision})` : null,
    ].filter(Boolean).join(', ')

    return `Property ${i + 1}: ${l.address} — ${details}`
  }).join('\n')

  return `Compare these ${listings.length} properties for a homebuyer. For each, note the pros and cons. Then give a brief recommendation on which might be the best value. Be concise and data-driven.\n\n${descriptions}`
}
