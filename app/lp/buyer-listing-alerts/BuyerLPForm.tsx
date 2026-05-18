'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { submitBuyerLPForm, type BuyerLPTimeline } from './actions'

const SEARCH_AREAS = [
  { slug: 'northwest-crossing', label: 'NW Crossing' },
  { slug: 'bend-river-west', label: 'River West (Bend)' },
  { slug: 'bend-old-bend', label: 'Old Bend' },
  { slug: 'bend-awbrey-butte', label: 'Awbrey Butte' },
  { slug: 'tetherow', label: 'Tetherow' },
  { slug: 'broken-top', label: 'Broken Top' },
  { slug: 'sunriver', label: 'Sunriver' },
  { slug: 'crosswater', label: 'Crosswater' },
  { slug: 'caldera-springs', label: 'Caldera Springs' },
  { slug: 'redmond', label: 'Redmond' },
  { slug: 'sisters', label: 'Sisters' },
  { slug: 'la-pine', label: 'La Pine' },
  { slug: 'other', label: 'Open to other Central Oregon areas' },
]

export default function BuyerLPForm() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [areas, setAreas] = useState<string[]>([])

  function toggleArea(slug: string) {
    setAreas((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  async function onSubmit(formData: FormData) {
    const submission = {
      name: formData.get('name')?.toString() ?? '',
      email: formData.get('email')?.toString() ?? '',
      phone: formData.get('phone')?.toString() ?? '',
      budgetMin: parseInt(formData.get('budgetMin')?.toString() ?? '', 10) || undefined,
      budgetMax: parseInt(formData.get('budgetMax')?.toString() ?? '', 10) || undefined,
      bedsMin: parseInt(formData.get('bedsMin')?.toString() ?? '', 10) || undefined,
      timeline: (formData.get('timeline')?.toString() || undefined) as BuyerLPTimeline | undefined,
      searchAreas: areas,
      notes: formData.get('notes')?.toString() ?? '',
    }
    startTransition(async () => {
      const r = await submitBuyerLPForm(submission)
      if (r.success) {
        setResult({ ok: true, msg: "Got it — your first batch of matches will be in your inbox within 30 minutes." })
      } else {
        setResult({ ok: false, msg: r.error })
      }
    })
  }

  if (result?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-lg font-semibold">Thanks!</p>
        <p className="mt-2 text-muted-foreground">{result.msg}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Anything specific to factor in?{' '}
          <a href="tel:+15417033095" className="text-primary underline">
            (541) 703-3095
          </a>
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Jane Smith" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="541.xxx.xxxx" />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="budgetMin">Budget min ($)</Label>
          <Input id="budgetMin" name="budgetMin" type="number" min="0" placeholder="400000" />
        </div>
        <div>
          <Label htmlFor="budgetMax">Budget max ($)</Label>
          <Input id="budgetMax" name="budgetMax" type="number" min="0" placeholder="600000" />
        </div>
      </div>
      <div>
        <Label>Where are you looking? (pick any)</Label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SEARCH_AREAS.map((a) => (
            <label key={a.slug} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={areas.includes(a.slug)}
                onCheckedChange={() => toggleArea(a.slug)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bedsMin">Beds min</Label>
          <Select name="bedsMin">
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="timeline">Timing</Label>
          <Select name="timeline">
            <SelectTrigger>
              <SelectValue placeholder="When are you looking to buy?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ready-now">Ready now (0–3 months)</SelectItem>
              <SelectItem value="next-3-6">3–6 months</SelectItem>
              <SelectItem value="next-6-12">6–12 months</SelectItem>
              <SelectItem value="exploring">Just exploring</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Anything specific?</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Must-haves, deal-breakers, anything I should know" />
      </div>
      {result?.ok === false && (
        <p className="text-sm text-destructive">{result.msg}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Setting up your search…' : 'Start my listing alerts'}
      </Button>
    </form>
  )
}
