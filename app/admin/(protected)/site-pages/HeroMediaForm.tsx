'use client'

import { useState } from 'react'
import {
  updateBrokerageHeroMedia,
  uploadBrokerageHeroImage,
  uploadBrokerageHeroVideo,
} from '@/app/actions/brokerage'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = {
  initialHeroVideoUrl: string | null
  initialHeroImageUrl: string | null
}

export default function HeroMediaForm({ initialHeroVideoUrl, initialHeroImageUrl }: Props) {
  const [heroVideoUrl, setHeroVideoUrl] = useState(initialHeroVideoUrl?.trim() || '')
  const [heroImageUrl, setHeroImageUrl] = useState(initialHeroImageUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageHeroMedia(
        heroVideoUrl.trim() || null,
        heroImageUrl.trim() || null
      )
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Hero video and image URLs saved. Homepage will update shortly.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadHeroVideo(formData: FormData) {
    setMessage(null)
    setUploadingVideo(true)
    try {
      const result = await uploadBrokerageHeroVideo(formData)
      if (result.ok && result.url) {
        setHeroVideoUrl(result.url)
        setMessage({ type: 'ok', text: 'Hero video uploaded and linked.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to upload video' })
      }
    } finally {
      setUploadingVideo(false)
    }
  }

  async function handleUploadHeroImage(formData: FormData) {
    setMessage(null)
    setUploadingImage(true)
    try {
      const result = await uploadBrokerageHeroImage(formData)
      if (result.ok && result.url) {
        setHeroImageUrl(result.url)
        setMessage({ type: 'ok', text: 'Hero image uploaded and linked.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to upload image' })
      }
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Homepage hero</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional background video or image for the homepage hero. When a video URL is set, it plays
        as the hero background (autoplay, muted, loop). Otherwise the image is used. Use a direct
        link to an MP4 file for video.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form action={handleUploadHeroVideo} className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor="hero-video-file" className="block text-sm font-medium text-muted-foreground">
            Upload hero video
          </Label>
          <Input id="hero-video-file" name="file" type="file" accept="video/mp4,video/webm" required />
          <Button type="submit" disabled={uploadingVideo} variant="outline">
            {uploadingVideo ? 'Uploading…' : 'Upload video'}
          </Button>
        </form>
        <form action={handleUploadHeroImage} className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor="hero-image-file" className="block text-sm font-medium text-muted-foreground">
            Upload hero image
          </Label>
          <Input id="hero-image-file" name="file" type="file" accept="image/*" required />
          <Button type="submit" disabled={uploadingImage} variant="outline">
            {uploadingImage ? 'Uploading…' : 'Upload image'}
          </Button>
        </form>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="hero-video-url" className="block text-sm font-medium text-muted-foreground">
            Hero video URL
          </Label>
          <Input
            id="hero-video-url"
            type="url"
            value={heroVideoUrl}
            onChange={(e) => setHeroVideoUrl(e.target.value)}
            placeholder="https://…/hero.mp4"
            className="mt-1 w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">
            Direct link to an MP4 file. Leave blank to use the image only.
          </p>
        </div>

        <div>
          <Label htmlFor="hero-image-url" className="block text-sm font-medium text-muted-foreground">
            Hero image URL (fallback or poster)
          </Label>
          <Input
            id="hero-image-url"
            type="url"
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://…/hero.jpg"
            className="mt-1 w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown when no video is set, or as poster/fallback while video loads.
          </p>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save hero media'}
        </Button>
      </form>

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
