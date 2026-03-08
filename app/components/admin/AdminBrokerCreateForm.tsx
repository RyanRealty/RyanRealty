'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBroker } from '@/app/actions/brokers'

type Props = { className?: string }

export default function AdminBrokerCreateForm({ className = '' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    slug: '',
    display_name: '',
    title: '',
    license_number: '',
    bio: '',
    photo_url: '',
    email: '',
    phone: '',
    google_review_url: '',
    zillow_review_url: '',
    sort_order: 0,
    is_active: true,
  })

  function slugFromName() {
    const name = form.display_name.trim()
    if (!name) return ''
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const slug = form.slug.trim() || slugFromName()
    if (!slug) {
      setMessage({ type: 'err', text: 'Slug is required (or enter display name first to generate one).' })
      return
    }
    if (!form.display_name.trim()) {
      setMessage({ type: 'err', text: 'Display name is required.' })
      return
    }
    if (!form.title.trim()) {
      setMessage({ type: 'err', text: 'Title is required.' })
      return
    }
    if (!form.license_number.trim()) {
      setMessage({ type: 'err', text: 'Oregon license number is required.' })
      return
    }
    setLoading(true)
    const result = await createBroker({
      slug,
      display_name: form.display_name.trim(),
      title: form.title.trim(),
      license_number: form.license_number.trim(),
      bio: form.bio.trim() || null,
      photo_url: form.photo_url.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      google_review_url: form.google_review_url.trim() || null,
      zillow_review_url: form.zillow_review_url.trim() || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
    })
    setLoading(false)
    if (result.ok) {
      router.push(`/admin/brokers/${result.id}`)
      router.refresh()
      return
    }
    setMessage({ type: 'err', text: result.error })
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
          <span className="text-sm font-medium text-zinc-700">Slug (URL) <span className="text-red-500">*</span></span>
          <input
            type="text"
            value={form.slug || slugFromName()}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="e.g. jane-doe"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-0.5 text-xs text-zinc-500">Profile URL: /team/[slug]</p>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Oregon license number <span className="text-red-500">*</span></span>
          <input
            type="text"
            required
            value={form.license_number}
            onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
            placeholder="e.g. 201206613"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Bio</span>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Photo URL</span>
          <input
            type="url"
            value={form.photo_url}
            onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Phone</span>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm"
        />
      </label>
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
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Adding…' : 'Add broker'}
      </button>
    </form>
  )
}
