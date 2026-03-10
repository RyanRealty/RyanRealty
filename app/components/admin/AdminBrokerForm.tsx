'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BrokerRow } from '@/app/actions/brokers'
import { updateBroker, deleteBroker } from '@/app/actions/brokers'

type Props = {
  broker: BrokerRow
  className?: string
}

export default function AdminBrokerForm({ broker, className = '' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    display_name: broker.display_name,
    title: broker.title,
    license_number: broker.license_number ?? '',
    bio: broker.bio ?? '',
    photo_url: broker.photo_url ?? '',
    email: broker.email ?? '',
    phone: broker.phone ?? '',
    google_review_url: broker.google_review_url ?? '',
    zillow_review_url: broker.zillow_review_url ?? '',
    sort_order: broker.sort_order,
    is_active: broker.is_active,
    tagline: broker.tagline ?? '',
    specialties: (broker.specialties ?? []).join(', '),
    designations: (broker.designations ?? []).join(', '),
    years_experience: broker.years_experience ?? '',
    social_instagram: broker.social_instagram ?? '',
    social_facebook: broker.social_facebook ?? '',
    social_linkedin: broker.social_linkedin ?? '',
    social_youtube: broker.social_youtube ?? '',
    social_tiktok: broker.social_tiktok ?? '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    const specialties = form.specialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const designations = form.designations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const yearsNum = typeof form.years_experience === 'number' ? form.years_experience : parseInt(String(form.years_experience), 10)
    const result = await updateBroker(broker.id, {
      display_name: form.display_name.trim() || undefined,
      title: form.title.trim() || undefined,
      license_number: form.license_number.trim() || null,
      bio: form.bio.trim() || null,
      photo_url: form.photo_url.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      google_review_url: form.google_review_url.trim() || null,
      zillow_review_url: form.zillow_review_url.trim() || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
      tagline: form.tagline.trim() || null,
      specialties: specialties.length > 0 ? specialties : null,
      designations: designations.length > 0 ? designations : null,
      years_experience: Number.isFinite(yearsNum) && yearsNum > 0 ? yearsNum : null,
      social_instagram: form.social_instagram.trim() || null,
      social_facebook: form.social_facebook.trim() || null,
      social_linkedin: form.social_linkedin.trim() || null,
      social_youtube: form.social_youtube.trim() || null,
      social_tiktok: form.social_tiktok.trim() || null,
    })
    setLoading(false)
    if (result.ok) {
      setMessage({ type: 'ok', text: 'Broker updated.' })
      router.refresh()
      return
    }
    setMessage({ type: 'err', text: result.error })
  }

  async function handleRemove() {
    if (!confirm(`Remove broker "${broker.display_name}"? This cannot be undone.`)) return
    setMessage(null)
    setLoading(true)
    const result = await deleteBroker(broker.id)
    setLoading(false)
    if (result.ok) router.push('/admin/brokers')
    else setMessage({ type: 'err', text: result.error })
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 rounded-xl border border-zinc-200 bg-white p-6 ${className}`}>
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Display name <span className="text-red-500">*</span></span>
          <input
            type="text"
            required
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Title <span className="text-red-500">*</span></span>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Principal Broker, Broker"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Oregon license number <span className="text-red-500">*</span></span>
        <p className="mt-0.5 text-xs text-zinc-500">Required for advertising compliance (Oregon Real Estate Agency).</p>
        <input
          type="text"
          required
          value={form.license_number}
          onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
          placeholder="e.g. 201206613"
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Tagline</span>
        <input
          type="text"
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          placeholder="Short tagline for agent hero"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Bio</span>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Specialties</span>
          <p className="mt-0.5 text-xs text-zinc-500">Comma-separated, e.g. First-time buyers, Luxury, Land</p>
          <input
            type="text"
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            placeholder="First-time buyers, Luxury, Land"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Designations</span>
          <p className="mt-0.5 text-xs text-zinc-500">Comma-separated, e.g. CRS, GRI</p>
          <input
            type="text"
            value={form.designations}
            onChange={(e) => setForm((f) => ({ ...f, designations: e.target.value }))}
            placeholder="CRS, GRI"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Years of experience</span>
        <input
          type="number"
          min={0}
          value={form.years_experience === '' ? '' : form.years_experience}
          onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value === '' ? '' : Number(e.target.value) }))}
          placeholder="e.g. 10"
          className="mt-1 block w-24 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Photo URL</span>
          <input
            type="url"
            value={form.photo_url}
            onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
            placeholder="https://..."
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Phone</span>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <div className="border-t border-zinc-200 pt-4">
        <h3 className="text-sm font-semibold text-zinc-800">Review links</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Add your Google and Zillow review page URLs so they appear on your public profile.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Google reviews URL</span>
            <input
              type="url"
              value={form.google_review_url}
              onChange={(e) => setForm((f) => ({ ...f, google_review_url: e.target.value }))}
              placeholder="https://g.page/... or Google Business profile link"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Zillow reviews URL</span>
            <input
              type="url"
              value={form.zillow_review_url}
              onChange={(e) => setForm((f) => ({ ...f, zillow_review_url: e.target.value }))}
              placeholder="https://www.zillow.com/..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
        </div>
      </div>
      <div className="border-t border-zinc-200 pt-4">
        <h3 className="text-sm font-semibold text-zinc-800">Social links</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Profile URLs for Instagram, Facebook, LinkedIn, YouTube, TikTok. Shown on public agent page when set.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Instagram</span>
            <input
              type="url"
              value={form.social_instagram}
              onChange={(e) => setForm((f) => ({ ...f, social_instagram: e.target.value }))}
              placeholder="https://instagram.com/..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Facebook</span>
            <input
              type="url"
              value={form.social_facebook}
              onChange={(e) => setForm((f) => ({ ...f, social_facebook: e.target.value }))}
              placeholder="https://facebook.com/..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">LinkedIn</span>
            <input
              type="url"
              value={form.social_linkedin}
              onChange={(e) => setForm((f) => ({ ...f, social_linkedin: e.target.value }))}
              placeholder="https://linkedin.com/in/..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">YouTube</span>
            <input
              type="url"
              value={form.social_youtube}
              onChange={(e) => setForm((f) => ({ ...f, social_youtube: e.target.value }))}
              placeholder="https://youtube.com/..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">TikTok</span>
            <input
              type="url"
              value={form.social_tiktok}
              onChange={(e) => setForm((f) => ({ ...f, social_tiktok: e.target.value }))}
              placeholder="https://tiktok.com/@..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6 border-t border-zinc-200 pt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-zinc-700">Active (visible on team page)</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700">Sort order</span>
          <input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-zinc-900"
          />
        </label>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        <a
          href={`/agents/${broker.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          View agent page
        </a>
        <a
          href={`/team/${broker.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          View team page
        </a>
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Remove broker
        </button>
      </div>
    </form>
  )
}
