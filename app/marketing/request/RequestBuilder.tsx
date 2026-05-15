'use client'

/**
 * Marketing request builder — a checklist that brokers fill out and click
 * "Build my email." The page emits a mailto: link to marketing@ryan-realty.com
 * with the subject + body pre-populated. The broker hits send in their email
 * client; the marketing inbox handles the rest.
 *
 * No backend writes from this page. No auth gate. Mailto is the contract.
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { DELIVERABLE_GROUPS, type Deliverable } from './deliverables'

const INBOX = 'marketing@ryan-realty.com'

function buildEmailBody(
  selectedItems: Deliverable[],
  ctx: { property: string; market: string; topic: string; details: string },
): string {
  const lines: string[] = []

  for (const item of selectedItems) {
    lines.push(`- ${item.prompt}`)
  }

  lines.push('')
  if (ctx.property) lines.push(`Property: ${ctx.property}`)
  if (ctx.market) lines.push(`Market / neighborhood: ${ctx.market}`)
  if (ctx.topic) lines.push(`Topic: ${ctx.topic}`)
  if (ctx.details) {
    lines.push('')
    lines.push('Extra context:')
    lines.push(ctx.details)
  }

  lines.push('')
  lines.push('Thanks!')

  return lines.join('\n')
}

function buildSubject(selectedItems: Deliverable[]): string {
  if (selectedItems.length === 0) return 'Marketing request'
  if (selectedItems.length === 1) return selectedItems[0].label
  if (selectedItems.length <= 3) return selectedItems.map((d) => d.label).join(' + ')
  return `${selectedItems[0].label} + ${selectedItems.length - 1} more`
}

export default function RequestBuilder() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [property, setProperty] = useState('')
  const [market, setMarket] = useState('')
  const [topic, setTopic] = useState('')
  const [details, setDetails] = useState('')

  const selectedItems = useMemo<Deliverable[]>(() => {
    const out: Deliverable[] = []
    for (const group of DELIVERABLE_GROUPS) {
      for (const item of group.items) {
        if (checked[item.id]) out.push(item)
      }
    }
    return out
  }, [checked])

  const needs = useMemo(
    () => ({
      property: selectedItems.some((d) => d.needsProperty),
      market: selectedItems.some((d) => d.needsMarket),
      topic: selectedItems.some((d) => d.needsTopic),
    }),
    [selectedItems],
  )

  const mailtoHref = useMemo(() => {
    const subject = buildSubject(selectedItems)
    const body = buildEmailBody(selectedItems, { property, market, topic, details })
    const qs = new URLSearchParams({ subject, body }).toString()
    return `mailto:${INBOX}?${qs}`
  }, [selectedItems, property, market, topic, details])

  const handleToggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const clearAll = () => {
    setChecked({})
    setProperty('')
    setMarket('')
    setTopic('')
    setDetails('')
  }

  return (
    <div className="space-y-8">
      {/* Sticky preview bar at the top once items are selected */}
      {selectedItems.length > 0 && (
        <Card className="border-primary/30 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <Badge variant="default" className="rounded-full">
                {selectedItems.length}
              </Badge>
              <span>selected</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
              {selectedItems.map((d) => (
                <li key={d.id}>{d.label}</li>
              ))}
            </ul>
            <Separator className="my-3" />
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={mailtoHref}>Build my email</a>
              </Button>
              <Button variant="outline" onClick={clearAll}>
                Clear all
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens your email client with the request pre-written. You hit send.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliverable groups */}
      {DELIVERABLE_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{group.blurb}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/30">
                  <Checkbox
                    id={item.id}
                    checked={!!checked[item.id]}
                    onCheckedChange={() => handleToggle(item.id)}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={item.id}
                    className="flex flex-col items-start gap-1 cursor-pointer flex-1 text-left leading-snug"
                  >
                    <span className="font-medium text-base">{item.label}</span>
                    <span className="text-sm font-normal text-muted-foreground">{item.description}</span>
                  </Label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* Context fields */}
      {selectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about it</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only the fields the team needs for what you picked. Skip anything you do not have.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {needs.property && (
              <div className="space-y-2">
                <Label htmlFor="property">Property address or MLS#</Label>
                <Input
                  id="property"
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  placeholder="19496 Tumalo Reservoir Rd, Bend OR 97703 — or MLS 220189422"
                />
              </div>
            )}
            {needs.market && (
              <div className="space-y-2">
                <Label htmlFor="market">City or neighborhood</Label>
                <Input
                  id="market"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  placeholder="Bend, Redmond, Sisters, Sunriver, Tetherow, Awbrey Butte, etc."
                />
              </div>
            )}
            {needs.topic && (
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Wildfire risk in Central Oregon. Rising days on market. Spring market outlook."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="details">Anything else we should know (optional)</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Open house Saturday 1–3pm. Price improvement coming Friday. Audience is out-of-state sellers. Deadline by end of week."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final CTA — repeats the preview bar at the bottom for mobile */}
      {selectedItems.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={mailtoHref}>Build my email</a>
              </Button>
              <Button variant="outline" onClick={clearAll}>
                Clear all
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens your email client with the request pre-written. You hit send.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
