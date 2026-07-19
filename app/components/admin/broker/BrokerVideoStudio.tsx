'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BrokerRow } from '@/app/actions/brokers'
import { uploadBrokerIntroVideo } from '@/app/actions/broker-headshot'
import { checkSynthesiaConfigured } from '@/app/actions/synthesia'
import { DEFAULT_INTRO_PROMPT, SYNTHESIA_AVATAR_OPTIONS } from '@/lib/synthesia-constants'
import {
  generateAndSaveSynthesiaIntroVideo,
  listBrokerGeneratedMedia,
  updateBrokerGeneratedMedia,
  deleteBrokerGeneratedMedia,
  setBrokerIntroVideoFromGenerated,
  type BrokerGeneratedMediaRow,
} from '@/app/actions/broker-generated-media'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BrokerFormMessage } from '../AdminBrokerForm'

type Props = {
  broker: BrokerRow
  initialGeneratedMedia: BrokerGeneratedMediaRow[]
  introVideoUrl: string
  onIntroVideoUrlChange: (url: string) => void
  setMessage: (msg: BrokerFormMessage) => void
}

/**
 * Synthesia AI intro-video generation + saved media library (concern 3 of 3, split out of the
 * former AdminBrokerForm god-component). Owns upload/generate/list/update/delete of broker
 * generated media. Reports the resolved intro video URL back up to the parent via
 * onIntroVideoUrlChange so the profile-CRUD sibling can persist it on save.
 */
export default function BrokerVideoStudio({ broker, initialGeneratedMedia, introVideoUrl, onIntroVideoUrlChange, setMessage }: Props) {
  const router = useRouter()
  const [introVideoUploading, setIntroVideoUploading] = useState(false)
  const [synthesiaGenerating, setSynthesiaGenerating] = useState(false)
  const [synthesiaConfigured, setSynthesiaConfigured] = useState<boolean | null>(null)
  const [generatedMedia, setGeneratedMedia] = useState<BrokerGeneratedMediaRow[]>(initialGeneratedMedia)
  const [synthesiaPrompt, setSynthesiaPrompt] = useState(DEFAULT_INTRO_PROMPT)
  const [synthesiaAvatarId, setSynthesiaAvatarId] = useState(SYNTHESIA_AVATAR_OPTIONS[0]?.id ?? '')
  const [synthesiaSetAsIntro, setSynthesiaSetAsIntro] = useState(true)
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null)
  const [editingMediaTitle, setEditingMediaTitle] = useState('')
  const introVideoFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkSynthesiaConfigured().then((r) => setSynthesiaConfigured(r.configured))
  }, [])
  useEffect(() => {
    setGeneratedMedia(initialGeneratedMedia)
  }, [initialGeneratedMedia])

  async function handleUploadIntroVideo() {
    setMessage(null)
    const fileInput = introVideoFileRef.current
    const file = fileInput?.files?.[0]
    if (!file) {
      setMessage({ type: 'err', text: 'Please choose a video file (MP4 or WebM).' })
      return
    }
    setIntroVideoUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadBrokerIntroVideo(broker.id, formData)
    setIntroVideoUploading(false)
    if (result.ok) {
      onIntroVideoUrlChange(result.url)
      setMessage({ type: 'ok', text: 'Intro video uploaded and set as broker hero video.' })
      router.refresh()
      if (fileInput) fileInput.value = ''
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleGenerateSynthesiaVideo() {
    setMessage(null)
    if (!synthesiaPrompt.trim()) {
      setMessage({ type: 'err', text: 'Please enter a script for the video.' })
      return
    }
    setSynthesiaGenerating(true)
    const result = await generateAndSaveSynthesiaIntroVideo({
      brokerId: broker.id,
      scriptText: synthesiaPrompt,
      avatarId: synthesiaAvatarId,
      title: `Intro - ${broker.display_name}`,
      setAsIntro: synthesiaSetAsIntro,
    })
    setSynthesiaGenerating(false)
    if (result.ok) {
      if (synthesiaSetAsIntro) onIntroVideoUrlChange(result.url)
      const list = await listBrokerGeneratedMedia(broker.id)
      setGeneratedMedia(list)
      setMessage({ type: 'ok', text: synthesiaSetAsIntro ? 'Intro video generated and set as hero.' : 'Intro video generated and saved.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleSetGeneratedAsIntro(mediaId: string) {
    setMessage(null)
    const result = await setBrokerIntroVideoFromGenerated(broker.id, mediaId)
    if (result.ok) {
      onIntroVideoUrlChange(result.url)
      setMessage({ type: 'ok', text: 'Set as intro video.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleUpdateGeneratedMediaTitle(mediaId: string, title: string) {
    const result = await updateBrokerGeneratedMedia(mediaId, { title: title || null })
    if (result.ok) {
      setGeneratedMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, title } : m)))
      setEditingMediaId(null)
      setEditingMediaTitle('')
      router.refresh()
    }
  }

  async function handleDeleteGeneratedMedia(mediaId: string) {
    if (!confirm('Remove this saved video/photo? It will no longer appear in the list.')) return
    setMessage(null)
    const result = await deleteBrokerGeneratedMedia(mediaId)
    if (result.ok) {
      setGeneratedMedia((prev) => prev.filter((m) => m.id !== mediaId))
      const deleted = generatedMedia.find((m) => m.id === mediaId)
      if (deleted && deleted.url === introVideoUrl) {
        onIntroVideoUrlChange('')
      }
      setMessage({ type: 'ok', text: 'Removed.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Intro video (hero / header)</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Optional video shown as the header/hero on the broker&apos;s agent and team page. If none is set, the page is built without a video hero.
      </p>
      {introVideoUrl && (
        <p className="mt-2 text-xs text-muted-foreground">
          Current: <span className="truncate font-mono">{introVideoUrl}</span>
        </p>
      )}
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-muted-foreground">Upload intro video</p>
          <p className="mt-0.5 text-xs text-muted-foreground">MP4 or WebM. Stored in broker storage and set as hero video.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Label className="block">
              <span className="sr-only">Intro video file</span>
              <Input
                ref={introVideoFileRef}
                type="file"
                accept="video/mp4,video/webm"
                className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-success file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-success-foreground file:hover:bg-success/85"
              />
            </Label>
            <Button
              type="button"
              onClick={handleUploadIntroVideo}
              disabled={introVideoUploading}
              className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground shadow-sm hover:bg-success/85 disabled:opacity-50"
            >
              {introVideoUploading ? 'Uploading…' : 'Upload intro video'}
            </Button>
          </div>
        </div>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Intro video URL</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Or paste a URL (e.g. from Vimeo, YouTube embed, or direct MP4/WebM). Save changes below to apply.</p>
          <Input
            type="url"
            value={introVideoUrl}
            onChange={(e) => onIntroVideoUrlChange(e.target.value)}
            placeholder="https://..."
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
      </div>

      {synthesiaConfigured === true && (
        <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="text-sm font-semibold text-foreground">Generate intro video (Synthesia)</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Create an AI avatar video with a default prompt. Use <code className="rounded bg-border px-0.5">[Broker Name]</code> in the script and it will be replaced with this broker&apos;s name.
          </p>
          <Label className="mt-3 block">
            <span className="text-xs font-medium text-muted-foreground">Script</span>
            <Textarea
              value={synthesiaPrompt}
              onChange={(e) => setSynthesiaPrompt(e.target.value)}
              rows={4}
              placeholder={DEFAULT_INTRO_PROMPT}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="mt-3 block">
            <span className="text-xs font-medium text-muted-foreground">Avatar</span>
            <Select value={synthesiaAvatarId} onValueChange={setSynthesiaAvatarId}>
              <SelectTrigger className="mt-1 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNTHESIA_AVATAR_OPTIONS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Label className="flex items-center gap-2">
              <Input
                type="checkbox"
                checked={synthesiaSetAsIntro}
                onChange={(e) => setSynthesiaSetAsIntro(e.target.checked)}
                className="h-4 w-4 rounded border-border text-success focus:ring-accent"
              />
              <span className="text-sm text-muted-foreground">Set as intro video when done</span>
            </Label>
            <Button
              type="button"
              onClick={handleGenerateSynthesiaVideo}
              disabled={synthesiaGenerating}
              className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground shadow-sm hover:bg-success/85 disabled:opacity-50"
            >
              {synthesiaGenerating ? 'Generating… (this may take a few minutes)' : 'Generate video'}
            </Button>
          </div>
        </div>
      )}
      {synthesiaConfigured === false && (
        <p className="mt-2 text-xs text-muted-foreground">Add SYNTHESIA_API_KEY to enable AI intro video generation.</p>
      )}

      {generatedMedia.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-foreground">Saved videos &amp; photos</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Generated or uploaded media. Edit title, delete, or set a video as the intro.</p>
          <ul className="mt-3 space-y-3">
            {generatedMedia.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                {m.type === 'video' ? (
                  <video src={m.url} className="h-20 w-32 rounded object-cover" muted playsInline />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- Dynamic media URLs from storage table in admin manager */
                  <img src={m.url} alt="Broker media" className="h-20 w-32 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  {editingMediaId === m.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="text"
                        value={editingMediaTitle}
                        onChange={(e) => setEditingMediaTitle(e.target.value)}
                        placeholder="Title"
                        className="rounded border border-border px-2 py-1 text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => handleUpdateGeneratedMediaTitle(m.id, editingMediaTitle)}
                        className="text-sm text-success hover:underline"
                      >
                        Save
                      </Button>
                      <Button type="button" onClick={() => { setEditingMediaId(null); setEditingMediaTitle('') }} className="text-sm text-muted-foreground hover:underline">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{m.title || (m.type === 'video' ? 'Video' : 'Photo')}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{m.source === 'synthesia' ? 'Synthesia' : 'Upload'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingMediaId !== m.id && (
                    <Button
                      type="button"
                      onClick={() => { setEditingMediaId(m.id); setEditingMediaTitle(m.title || '') }}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Edit title
                    </Button>
                  )}
                  {m.type === 'video' && introVideoUrl !== m.url && (
                    <Button
                      type="button"
                      onClick={() => handleSetGeneratedAsIntro(m.id)}
                      className="text-sm text-success hover:underline"
                    >
                      Set as intro
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => handleDeleteGeneratedMedia(m.id)}
                    className="text-sm text-destructive hover:underline"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
