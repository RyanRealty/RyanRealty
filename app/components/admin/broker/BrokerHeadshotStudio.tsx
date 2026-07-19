'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BrokerRow } from '@/app/actions/brokers'
import {
  uploadBrokerHeadshot,
  generateBrokerHeadshot,
  checkReplicateConfigured,
  addBrokerSavedHeadshot,
  setBrokerHeadshotDefault,
} from '@/app/actions/broker-headshot'
import {
  listHeadshotPrompts,
  createHeadshotPrompt,
  updateHeadshotPrompt,
  deleteHeadshotPrompt,
  type HeadshotPromptOption,
} from '@/app/actions/headshot-prompts'
import type { HeadshotGender } from '@/lib/headshot-prompt'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HeadshotLightbox } from '@/app/components/admin/broker/HeadshotLightbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BrokerFormMessage } from '../AdminBrokerForm'

type Props = {
  broker: BrokerRow
  photoUrl: string
  onPhotoUrlChange: (url: string) => void
  setMessage: (msg: BrokerFormMessage) => void
}

/**
 * AI headshot prompt library + upload/generate/save flow (concern 2 of 3, split out of the
 * former AdminBrokerForm god-component). Owns the default-photo thumbnail, the generated-preview
 * review step, saved headshots, and the prompt CRUD panel. Reports the resolved default photo URL
 * back up to the parent via onPhotoUrlChange so the profile-CRUD sibling can persist it on save.
 */
export default function BrokerHeadshotStudio({ broker, photoUrl, onPhotoUrlChange, setMessage }: Props) {
  const router = useRouter()
  const [headshotUploading, setHeadshotUploading] = useState(false)
  const [headshotGenerating, setHeadshotGenerating] = useState(false)
  const [replicateConfigured, setReplicateConfigured] = useState<boolean | null>(null)
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null)
  const [savedHeadshots, setSavedHeadshots] = useState<string[]>(broker.saved_headshot_urls ?? [])
  const [gender, setGender] = useState<HeadshotGender>('Male')
  const [promptOptions, setPromptOptions] = useState<HeadshotPromptOption[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string>('default')
  const [managePromptsOpen, setManagePromptsOpen] = useState(false)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingPromptForm, setEditingPromptForm] = useState({ name: '', body: '' })
  const [newPromptForm, setNewPromptForm] = useState({ name: '', body: '' })
  const [promptMessage, setPromptMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false)
  const [headshotLightboxUrl, setHeadshotLightboxUrl] = useState<string | null>(null)
  const headshotFileRef = useRef<HTMLInputElement>(null)
  const aiSourceFileRef = useRef<HTMLInputElement>(null)
  const headshotSectionRef = useRef<HTMLDivElement>(null)
  const generatedPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkReplicateConfigured().then((r) => setReplicateConfigured(r.configured))
  }, [])

  async function loadPrompts() {
    const list = await listHeadshotPrompts(gender)
    setPromptOptions(list)
  }
  useEffect(() => {
    loadPrompts()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors legacy ref-read-at-mount behavior; gender changes intentionally do not auto-reload prompts
  }, [])

  // When a new headshot is generated, scroll it into view so the user sees the result
  useEffect(() => {
    if (generatedPreviewUrl && generatedPreviewRef.current) {
      generatedPreviewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [generatedPreviewUrl])

  async function handleUploadHeadshot() {
    setMessage(null)
    const fileInput = headshotFileRef.current
    const file = fileInput?.files?.[0]
    if (!file) {
      setMessage({ type: 'err', text: 'Please choose an image file.' })
      return
    }
    setHeadshotUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadBrokerHeadshot(broker.id, formData)
    setHeadshotUploading(false)
    if (result.ok) {
      onPhotoUrlChange(result.url)
      setMessage({ type: 'ok', text: 'Headshot uploaded and set as broker photo.' })
      router.refresh()
      if (fileInput) fileInput.value = ''
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleGenerateHeadshot() {
    setMessage(null)
    const fileInput = aiSourceFileRef.current
    const file = fileInput?.files?.[0]
    if (!file) {
      setMessage({ type: 'err', text: 'Please choose a source photo.' })
      return
    }
    setHeadshotGenerating(true)
    setGeneratedPreviewUrl(null)
    headshotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const formData = new FormData()
    formData.set('file', file)
    const result = await generateBrokerHeadshot(broker.id, formData, gender, selectedPromptId)
    setHeadshotGenerating(false)
    if (result.ok) {
      setGeneratedPreviewUrl(result.url)
      setMessage({ type: 'ok', text: 'Headshot generated. Set as default, save, or generate another.' })
      if (fileInput) fileInput.value = ''
    } else {
      setMessage({ type: 'err', text: result.error ?? 'Generation failed' })
    }
  }

  async function handleSetGeneratedAsDefault() {
    if (!generatedPreviewUrl) return
    setMessage(null)
    const result = await setBrokerHeadshotDefault(broker.id, generatedPreviewUrl)
    if (result.ok) {
      onPhotoUrlChange(generatedPreviewUrl)
      setSavedHeadshots((prev) => (prev.includes(generatedPreviewUrl) ? prev : [...prev, generatedPreviewUrl]))
      setGeneratedPreviewUrl(null)
      setMessage({ type: 'ok', text: 'Set as default photo. It will appear on the site.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleSaveGenerated() {
    if (!generatedPreviewUrl) return
    setMessage(null)
    const result = await addBrokerSavedHeadshot(broker.id, generatedPreviewUrl)
    if (result.ok) {
      setSavedHeadshots((prev) => (prev.includes(generatedPreviewUrl) ? prev : [...prev, generatedPreviewUrl]))
      setGeneratedPreviewUrl(null)
      setMessage({ type: 'ok', text: 'Saved. You can set it as default later from the list below.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleSetSavedAsDefault(url: string) {
    setMessage(null)
    const result = await setBrokerHeadshotDefault(broker.id, url)
    if (result.ok) {
      onPhotoUrlChange(url)
      setMessage({ type: 'ok', text: 'Default photo updated.' })
      router.refresh()
    } else {
      setMessage({ type: 'err', text: result.error })
    }
  }

  async function handleCreatePrompt() {
    setPromptMessage(null)
    if (!newPromptForm.name.trim()) {
      setPromptMessage({ type: 'err', text: 'Enter a name for the prompt.' })
      return
    }
    setPromptsLoading(true)
    const result = await createHeadshotPrompt({ name: newPromptForm.name.trim(), body: newPromptForm.body.trim() })
    setPromptsLoading(false)
    if (result.ok) {
      setNewPromptForm({ name: '', body: '' })
      setPromptMessage({ type: 'ok', text: 'Prompt saved.' })
      await loadPrompts()
      setSelectedPromptId(result.id)
    } else {
      setPromptMessage({ type: 'err', text: result.error })
    }
  }

  async function handleUpdatePrompt() {
    if (!editingPromptId) return
    setPromptMessage(null)
    if (!editingPromptForm.name.trim()) {
      setPromptMessage({ type: 'err', text: 'Enter a name for the prompt.' })
      return
    }
    setPromptsLoading(true)
    const result = await updateHeadshotPrompt(editingPromptId, {
      name: editingPromptForm.name.trim(),
      body: editingPromptForm.body.trim(),
    })
    setPromptsLoading(false)
    if (result.ok) {
      setEditingPromptId(null)
      setEditingPromptForm({ name: '', body: '' })
      setPromptMessage({ type: 'ok', text: 'Prompt updated.' })
      await loadPrompts()
    } else {
      setPromptMessage({ type: 'err', text: result.error })
    }
  }

  async function handleDeletePrompt(id: string) {
    if (!confirm('Delete this prompt? It cannot be undone.')) return
    setPromptMessage(null)
    setPromptsLoading(true)
    const result = await deleteHeadshotPrompt(id)
    setPromptsLoading(false)
    if (result.ok) {
      setPromptMessage({ type: 'ok', text: 'Prompt deleted.' })
      if (selectedPromptId === id) setSelectedPromptId('default')
      setEditingPromptId(null)
      await loadPrompts()
    } else {
      setPromptMessage({ type: 'err', text: result.error })
    }
  }

  function startEditingPrompt(p: HeadshotPromptOption) {
    if (p.isDefault) return
    setEditingPromptId(p.id)
    setEditingPromptForm({ name: p.name, body: p.body })
  }

  async function handleDuplicateDefault() {
    const defaultOpt = promptOptions.find((o) => o.isDefault)
    if (!defaultOpt) return
    setPromptMessage(null)
    setPromptsLoading(true)
    const result = await createHeadshotPrompt({
      name: `${defaultOpt.name} (copy)`,
      body: defaultOpt.body,
    })
    setPromptsLoading(false)
    if (result.ok) {
      setPromptMessage({ type: 'ok', text: 'Duplicate created. You can edit it below.' })
      await loadPrompts()
      setSelectedPromptId(result.id)
      setEditingPromptId(result.id)
      setEditingPromptForm({ name: `${defaultOpt.name} (copy)`, body: defaultOpt.body })
    } else {
      setPromptMessage({ type: 'err', text: result.error })
    }
  }

  return (
    <div ref={headshotSectionRef} className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Headshot</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Upload a headshot or generate one with AI. Only the default photo is used on the site. You can save multiple and pick one.
      </p>
      {headshotGenerating && (
        <div className="mt-4 flex items-center gap-4 rounded-lg border-2 border-warning/40 bg-warning/10 p-4" role="status" aria-live="polite">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-warning border-t-transparent" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Generating professional headshot…</p>
            <p className="text-xs text-warning">This usually takes 1-2 minutes. Please wait, and do not leave or refresh.</p>
          </div>
        </div>
      )}
      {photoUrl && (
        <div className="mt-3 flex items-start gap-4">
          <Button
            type="button"
            onClick={() => setHeadshotLightboxUrl(photoUrl)}
            className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            title="View full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Broker headshot: dynamic URL (upload/AI); next/image not used for admin form */}
            <img
              src={photoUrl}
              alt={`${broker.display_name} headshot`}
              className="h-full w-full object-contain"
            />
          </Button>
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
            Current default (shown on team/agent pages). Replace by uploading, generating with AI, or choosing a saved headshot below.
          </div>
        </div>
      )}
      {generatedPreviewUrl && (
        <div ref={generatedPreviewRef} className="mt-4 rounded-lg border-2 border-success/40 bg-success/10/80 p-4">
          <p className="text-sm font-medium text-success">Your new headshot, review and choose an action</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <Button
              type="button"
              onClick={() => setHeadshotLightboxUrl(generatedPreviewUrl)}
              className="relative flex h-44 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              title="Click to view full size"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Generated headshot blob URL; next/image not used in admin form */}
              <img
                src={generatedPreviewUrl}
                alt="Generated headshot, review before saving or setting as default"
                className="h-full w-full object-contain"
              />
            </Button>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleSetGeneratedAsDefault}
                className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground shadow-sm hover:bg-success/85"
              >
                Set as default (use on site)
              </Button>
              <Button
                type="button"
                onClick={handleSaveGenerated}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Save for later
              </Button>
              <Button
                type="button"
                onClick={() => { setGeneratedPreviewUrl(null); setMessage(null); }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Generate another
              </Button>
              <Button
                type="button"
                onClick={() => { setGeneratedPreviewUrl(null); setMessage(null); }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Disregard (don’t save)
              </Button>
            </div>
          </div>
        </div>
      )}
      {savedHeadshots.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-muted-foreground">Saved headshots</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose one as default to show on the site.</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {savedHeadshots.map((url) => {
              const isDefault = photoUrl?.trim() === url.trim()
              return (
                <li key={url} className="flex items-center gap-2">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Saved headshot from storage; dynamic URL in admin form */}
                    <img src={url} alt="Broker headshot" className="h-full w-full object-cover" />
                    {isDefault && (
                      <span className="absolute bottom-0 left-0 right-0 bg-success px-1 py-0.5 text-center text-[10px] font-medium text-success-foreground">
                        Default
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSetSavedAsDefault(url)}
                    disabled={isDefault}
                    className="rounded border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-default"
                  >
                    {isDefault ? 'Default' : 'Set as default'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-muted-foreground">1. Upload headshot</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose an image file and click Upload to set it as the broker photo.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Label className="block">
              <span className="sr-only">Headshot image</span>
              <Input
                ref={headshotFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-success file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-success-foreground file:hover:bg-success/85"
              />
            </Label>
            <Button
              type="button"
              onClick={handleUploadHeadshot}
              disabled={headshotUploading}
              className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground shadow-sm hover:bg-success/85 disabled:opacity-50"
            >
              {headshotUploading ? 'Uploading…' : 'Upload headshot'}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-muted-foreground">2. Generate professional headshot with AI</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose a prompt, upload a source photo, then generate. The AI will create a headshot matching the prompt (e.g. studio, wardrobe, background). Takes 1-2 minutes. Then set as default, save, or generate another.
          </p>
          {replicateConfigured === false && (
            <p className="mt-2 text-sm text-warning">
              Replicate not configured. Add <code className="rounded bg-warning/15 px-1">REPLICATE_API_TOKEN</code> to <code className="rounded bg-warning/15 px-1">.env.local</code> and restart the dev server (npm run dev).
            </p>
          )}
          {replicateConfigured === true && (
            <p className="mt-1 text-xs text-success">Replicate configured.</p>
          )}
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="block">
                <span className="mr-2 text-sm font-medium text-muted-foreground">Prompt</span>
                <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                  <SelectTrigger aria-describedby="prompt-select-help">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promptOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.isDefault ? ' (built-in)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Button
                type="button"
                onClick={() => setPromptPreviewOpen((o) => !o)}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {promptPreviewOpen ? 'Hide prompt text' : 'View prompt text'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setManagePromptsOpen((o) => !o)
                  setPromptMessage(null)
                  if (!managePromptsOpen) loadPrompts()
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                {managePromptsOpen ? 'Close manage prompts' : 'Manage prompts'}
              </Button>
            </div>
            <p id="prompt-select-help" className="text-xs text-muted-foreground">
              The selected prompt is sent to the AI. Use &quot;Manage prompts&quot; to add, edit, or delete custom prompts. Use <code className="rounded bg-border px-1">[GENDER]</code> in custom prompts to insert Male/Female.
            </p>
            {promptPreviewOpen && (() => {
              const current = promptOptions.find((p) => p.id === selectedPromptId)
              return current ? (
                <pre className="max-h-48 overflow-auto rounded border border-border bg-muted p-3 text-xs text-foreground whitespace-pre-wrap font-sans">
                  {current.body}
                </pre>
              ) : null
            })()}
          </div>
          {managePromptsOpen && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Manage prompts</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add custom prompts or edit saved ones. The default prompt is read-only. Duplicate it to create an editable copy.
              </p>
              {promptMessage && (
                <p className={`mt-2 text-sm ${promptMessage.type === 'ok' ? 'text-success' : 'text-destructive'}`}>
                  {promptMessage.text}
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {promptOptions.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2">
                    <span className="font-medium text-foreground">{p.name}</span>
                    {p.isDefault && <span className="rounded bg-border px-1.5 py-0.5 text-xs text-muted-foreground">Built-in</span>}
                    {p.isDefault ? (
                      <Button
                        type="button"
                        onClick={handleDuplicateDefault}
                        disabled={promptsLoading}
                        className="text-sm text-success hover:underline disabled:opacity-50"
                      >
                        Duplicate to edit
                      </Button>
                    ) : editingPromptId === p.id ? (
                      <>
                        <Button type="button" onClick={handleUpdatePrompt} disabled={promptsLoading} className="text-sm text-success hover:underline disabled:opacity-50">Save</Button>
                        <Button type="button" onClick={() => { setEditingPromptId(null); setEditingPromptForm({ name: '', body: '' }); }} className="text-sm text-muted-foreground hover:underline">Cancel</Button>
                        <Button type="button" onClick={() => handleDeletePrompt(p.id)} disabled={promptsLoading} className="text-sm text-destructive hover:underline disabled:opacity-50">Delete</Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" onClick={() => startEditingPrompt(p)} className="text-sm text-success hover:underline">Edit</Button>
                        <Button type="button" onClick={() => handleDeletePrompt(p.id)} disabled={promptsLoading} className="text-sm text-destructive hover:underline disabled:opacity-50">Delete</Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {editingPromptId && (
                <div className="mt-4 rounded border border-success/30 bg-success/10/50 p-4">
                  <p className="text-sm font-medium text-foreground">Edit prompt</p>
                  <Label className="mt-2 block">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <Input
                      type="text"
                      value={editingPromptForm.name}
                      onChange={(e) => setEditingPromptForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-0.5 block w-full max-w-md rounded border border-border px-2 py-1.5 text-sm"
                      placeholder="e.g. Outdoor casual"
                    />
                  </Label>
                  <Label className="mt-2 block">
                    <span className="text-xs text-muted-foreground">Prompt text (use [GENDER] for Male/Female)</span>
                    <Textarea
                      value={editingPromptForm.body}
                      onChange={(e) => setEditingPromptForm((f) => ({ ...f, body: e.target.value }))}
                      rows={8}
                      className="mt-0.5 block w-full rounded border border-border px-2 py-1.5 text-sm font-mono"
                      placeholder="Professional headshot..."
                    />
                  </Label>
                </div>
              )}
              <div className="mt-4 rounded border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Add new prompt</p>
                <Label className="mt-2 block">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <Input
                    type="text"
                    value={newPromptForm.name}
                    onChange={(e) => setNewPromptForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-0.5 block w-full max-w-md rounded border border-border px-2 py-1.5 text-sm"
                    placeholder="e.g. Outdoor casual"
                  />
                </Label>
                <Label className="mt-2 block">
                  <span className="text-xs text-muted-foreground">Prompt text (use [GENDER] for Male/Female)</span>
                  <Textarea
                    value={newPromptForm.body}
                    onChange={(e) => setNewPromptForm((f) => ({ ...f, body: e.target.value }))}
                    rows={8}
                    className="mt-0.5 block w-full rounded border border-border px-2 py-1.5 text-sm font-mono"
                    placeholder="Professional headshot, [GENDER] subject..."
                  />
                </Label>
                <Button
                  type="button"
                  onClick={handleCreatePrompt}
                  disabled={promptsLoading}
                  className="mt-3 rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground hover:bg-success/85 disabled:opacity-50"
                >
                  {promptsLoading ? 'Saving…' : 'Save prompt'}
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Label className="block">
              <span className="sr-only">Source photo</span>
              <Input
                ref={aiSourceFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-success file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-success-foreground file:hover:bg-success/85"
              />
            </Label>
            <Label className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Subject:</span>
              <Select value={gender} onValueChange={(v) => setGender(v as HeadshotGender)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Button
              type="button"
              onClick={handleGenerateHeadshot}
              disabled={headshotGenerating}
              className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-success-foreground shadow-sm hover:bg-success/85 disabled:opacity-50"
            >
              {headshotGenerating ? 'Generating…' : 'Generate professional headshot'}
            </Button>
          </div>
        </div>
      </div>

      <HeadshotLightbox url={headshotLightboxUrl} onClose={() => setHeadshotLightboxUrl(null)} />
    </div>
  )
}
