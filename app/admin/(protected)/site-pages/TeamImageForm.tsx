'use client'

import Image from 'next/image'
import { useState } from 'react'
import { updateBrokerageTeamImageUrl, uploadBrokerageTeamImage } from '@/app/actions/brokerage'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = {
  initialTeamImageUrl: string | null
}

export default function TeamImageForm({ initialTeamImageUrl }: Props) {
  const [teamImageUrl, setTeamImageUrl] = useState(initialTeamImageUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageTeamImageUrl(teamImageUrl.trim() || null)
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Team image URL saved. Homepage will update shortly.' })
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
      const result = await uploadBrokerageTeamImage(formData)
      if (result.ok && result.url) {
        setTeamImageUrl(result.url)
        setMessage({ type: 'ok', text: 'Team image uploaded and set. Homepage will update shortly.' })
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
      <h2 className="text-lg font-semibold text-foreground">Team image (social proof)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Image shown in the homepage testimonials block next to reviews. Upload a PNG (e.g. with transparent
        background) or paste a URL. You can change it anytime here.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        {teamImageUrl && (
          <div className="relative h-24 w-32 overflow-hidden rounded-md border border-border bg-white dark:bg-zinc-100">
            <Image
              src={teamImageUrl}
              alt="Team image preview"
              fill
              className="object-contain object-center"
              unoptimized
              onError={() => setMessage({ type: 'err', text: 'Preview failed to load. Check the URL or upload a new image.' })}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <form onSubmit={handleSaveUrl} className="flex flex-wrap items-end gap-2">
            <Label className="w-full text-sm font-medium text-muted-foreground sm:w-auto">Team image URL</Label>
            <Input
              type="url"
              value={teamImageUrl}
              onChange={(e) => setTeamImageUrl(e.target.value)}
              placeholder="https://…/team.png"
              className="min-w-[200px] flex-1"
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save URL'}
            </Button>
          </form>

          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2">
            <Label className="w-full text-sm font-medium text-muted-foreground sm:w-auto">Or upload image (saved to Supabase)</Label>
            <Input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              className="file:mr-2 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
            />
            <Button type="submit" disabled={uploading}>
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
