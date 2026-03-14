'use client'

import Image from 'next/image'
import { useState } from 'react'
import { updateBrokerageLogoUrl, uploadBrokerageLogo } from '@/app/actions/brokerage'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

type Props = {
  initialLogoUrl: string | null
}

export default function SiteLogoForm({ initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const displayUrl = logoUrl || `${siteUrl}/logo.png`

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageLogoUrl(logoUrl.trim() || null)
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Logo URL saved. It may take a moment to appear on the site.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    if (!formData.get('file')) {
      setMessage({ type: 'err', text: 'Please choose an image file.' })
      return
    }
    setUploading(true)
    try {
      const result = await uploadBrokerageLogo(formData)
      if (result.ok && result.url) {
        setLogoUrl(result.url)
        setMessage({ type: 'ok', text: 'Logo uploaded and set. It may take a moment to appear on the site.' })
        form.reset()
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Upload failed' })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Site logo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown in the header on all pages. Use a PNG or SVG with transparent background for best results. Recommended height ~48px.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="flex h-14 items-center rounded-lg border border-border bg-muted px-4">
          <Image
            src={displayUrl}
            alt="Logo preview"
            width={160}
            height={48}
            className="h-10 w-auto max-h-12 object-contain object-left"
            onError={() => setMessage({ type: 'err', text: 'Preview failed to load. Check the URL or upload a new image.' })}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <form onSubmit={handleSaveUrl} className="flex flex-wrap items-end gap-2">
            <Label className="w-full text-sm font-medium text-muted-foreground sm:w-auto">Logo URL</Label>
            <Input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={`${siteUrl}/logo.png`}
              className="min-w-[200px] flex-1 rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save URL'}
            </Button>
          </form>

          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2">
            <Label className="w-full text-sm font-medium text-muted-foreground sm:w-auto">Or upload image</Label>
            <Input
              type="file"
              name="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="rounded-lg border border-primary/20 px-2 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
            />
            <Button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload & set'}
            </Button>
          </form>
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 text-sm ${message.type === 'ok' ? 'text-success' : 'text-destructive'}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
