'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setBuyingPreferences } from '@/app/actions/buying-preferences'
import type { BuyingPreferences } from '@/app/actions/buying-preferences'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = { initial?: BuyingPreferences | null }

export default function BuyingPreferencesForm({ initial }: Props) {
  const router = useRouter()
  const [down, setDown] = useState(initial?.downPaymentPercent ?? 20)
  const [rate, setRate] = useState(initial?.interestRate ?? 7)
  const [term, setTerm] = useState(initial?.loanTermYears ?? 30)
  const [maxPrice, setMaxPrice] = useState<string>(initial?.maxPrice != null ? String(initial.maxPrice) : '')
  const [minBeds, setMinBeds] = useState<string>(initial?.minBeds != null ? String(initial.minBeds) : '')
  const [minBaths, setMinBaths] = useState<string>(initial?.minBaths != null ? String(initial.minBaths) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'error' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const maxPriceNum = maxPrice.trim() === '' ? null : parseInt(maxPrice.replace(/\D/g, ''), 10)
    const minBedsNum = minBeds.trim() === '' ? null : parseInt(minBeds, 10)
    const minBathsNum = minBaths.trim() === '' ? null : parseFloat(minBaths)
    const { error } = await setBuyingPreferences({
      downPaymentPercent: down,
      interestRate: rate,
      loanTermYears: term,
      maxPrice: maxPriceNum != null && maxPriceNum > 0 ? maxPriceNum : null,
      minBeds: minBedsNum != null && minBedsNum > 0 ? minBedsNum : null,
      minBaths: minBathsNum != null && minBathsNum > 0 ? minBathsNum : null,
    })
    setSaving(false)
    setMsg(error ? 'error' : 'saved')
    if (!error) router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Down payment (%)</span>
        <Input type="number" min={0} max={100} step={1} value={down} onChange={(e) => setDown(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground" />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Interest rate (%)</span>
        <Input type="number" min={0} max={20} step={0.25} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground" />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Loan term (years)</span>
        <Select value={String(term)} onValueChange={(e) => setTerm(Number(e))}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="15">15</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="30">30</SelectItem>
          </SelectContent>
        </Select>
      </Label>
      <p className="text-sm text-muted-foreground">Optional: used to curate &quot;Homes for You&quot; on the home page.</p>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Max price (optional)</span>
        <Input type="text" inputMode="numeric" placeholder="e.g. 600000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground" />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Min beds (optional)</span>
        <Input type="number" min={0} placeholder="e.g. 2" value={minBeds || ''} onChange={(e) => setMinBeds(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground" />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Min baths (optional)</span>
        <Input type="number" min={0} step={0.5} placeholder="e.g. 2" value={minBaths || ''} onChange={(e) => setMinBaths(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground" />
      </Label>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
        {msg === 'saved' && <span className="text-sm text-success">Saved.</span>}
        {msg === 'error' && <span className="text-sm text-destructive">Could not save.</span>}
      </div>
    </form>
  )
}
