'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setBuyingPreferences } from '@/app/actions/buying-preferences'
import type { BuyingPreferences } from '@/app/actions/buying-preferences'

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
    <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Down payment (%)</span>
        <input type="number" min={0} max={100} step={1} value={down} onChange={(e) => setDown(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Interest rate (%)</span>
        <input type="number" min={0} max={20} step={0.25} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Loan term (years)</span>
        <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900">
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
        </select>
      </label>
      <p className="text-sm text-zinc-600">Optional: used to curate &quot;Homes for You&quot; on the home page.</p>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Max price (optional)</span>
        <input type="text" inputMode="numeric" placeholder="e.g. 600000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Min beds (optional)</span>
        <input type="number" min={0} placeholder="e.g. 2" value={minBeds || ''} onChange={(e) => setMinBeds(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Min baths (optional)</span>
        <input type="number" min={0} step={0.5} placeholder="e.g. 2" value={minBaths || ''} onChange={(e) => setMinBaths(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {msg === 'saved' && <span className="text-sm text-emerald-600">Saved.</span>}
        {msg === 'error' && <span className="text-sm text-red-600">Could not save.</span>}
      </div>
    </form>
  )
}
