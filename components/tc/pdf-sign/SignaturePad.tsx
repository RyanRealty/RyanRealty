'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ADOPT_METHOD_LABEL, type AdoptMethod } from '@/lib/tc/adopt-signature'

/**
 * Adopt a signature: draw, type, or upload a picture. Returns a transparent PNG.
 * No app. Same three choices as live DigiSign.
 */
export function SignaturePad({
  open,
  onOpenChange,
  title,
  defaultName,
  confirmLabel = 'Adopt',
  onComplete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  defaultName?: string
  confirmLabel?: string
  onComplete: (png: string) => void
}) {
  const [tab, setTab] = useState<AdoptMethod>('type')
  const [typed, setTyped] = useState(defaultName ?? '')
  const [uploadPng, setUploadPng] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (open) {
      setTyped(defaultName ?? '')
      setUploadPng(null)
      setUploadError(null)
      dirtyRef.current = false
      requestAnimationFrame(() => clearCanvas())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    dirtyRef.current = false
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height }
  }
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.strokeStyle = '#102742'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    c.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    dirtyRef.current = true
  }
  const end = () => {
    drawingRef.current = false
  }

  const finish = () => {
    if (tab === 'type') {
      const png = scriptTextToPng(typed.trim())
      if (!png) return
      onComplete(png)
      onOpenChange(false)
      return
    }
    if (tab === 'upload') {
      if (!uploadPng) return
      onComplete(uploadPng)
      onOpenChange(false)
      return
    }
    if (!dirtyRef.current) return
    const png = canvasRef.current!.toDataURL('image/png')
    onComplete(png)
    onOpenChange(false)
  }

  function onUpload(file: File | undefined) {
    setUploadError(null)
    setUploadPng(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Pick a photo or a scan of your signature.')
      return
    }
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 600
      c.height = 160
      const ctx = c.getContext('2d')
      if (!ctx) return
      const scale = Math.min(c.width / img.width, c.height / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h)
      setUploadPng(c.toDataURL('image/png'))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => setUploadError('That picture could not be read. Try another.')
    img.src = URL.createObjectURL(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as AdoptMethod)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="type">{ADOPT_METHOD_LABEL.type}</TabsTrigger>
            <TabsTrigger value="draw">{ADOPT_METHOD_LABEL.draw}</TabsTrigger>
            <TabsTrigger value="upload">{ADOPT_METHOD_LABEL.upload}</TabsTrigger>
          </TabsList>
          <TabsContent value="type" className="mt-3">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full name" autoFocus />
            <div className="mt-3 flex h-[120px] items-center justify-center rounded-md border border-border bg-white">
              <span style={{ fontFamily: '"Brush Script MT","Snell Roundhand",cursive', fontStyle: 'italic', fontSize: 44, color: '#102742' }}>
                {typed || 'Your name'}
              </span>
            </div>
          </TabsContent>
          <TabsContent value="draw" className="mt-3">
            <div className="rounded-md border border-border bg-white">
              <canvas
                ref={canvasRef}
                width={560}
                height={200}
                className="h-[200px] w-full touch-none rounded-md"
                style={{ touchAction: 'none' }}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
              />
            </div>
            <button onClick={clearCanvas} className="mt-2 text-xs text-muted-foreground underline underline-offset-2">
              Clear
            </button>
          </TabsContent>
          <TabsContent value="upload" className="mt-3">
            <label className="block text-sm text-muted-foreground">
              A photo or scan of your signature. Nothing is installed on your phone.
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-2 block w-full text-sm"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </label>
            {uploadPng ? (
              <div className="mt-3 flex h-[120px] items-center justify-center rounded-md border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadPng} alt="Uploaded signature preview" className="max-h-[110px] max-w-full object-contain" />
              </div>
            ) : null}
            {uploadError ? <p className="mt-2 text-sm text-destructive">{uploadError}</p> : null}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={finish}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function scriptTextToPng(text: string): string | null {
  const name = text.trim()
  if (!name || typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 160
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#102742'
  ctx.font = 'italic 64px "Brush Script MT","Snell Roundhand",cursive'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 16, 88)
  return c.toDataURL('image/png')
}
