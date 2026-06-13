'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

/**
 * Signature / initials capture. Draw with a finger or mouse, or type a name
 * rendered in a script-style face. Returns a transparent PNG data URL.
 */
export function SignaturePad({
  open,
  onOpenChange,
  title,
  defaultName,
  onComplete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  defaultName?: string
  onComplete: (png: string) => void
}) {
  const [tab, setTab] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState(defaultName ?? '')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (open) {
      setTyped(defaultName ?? '')
      dirtyRef.current = false
      // clear after the dialog paints
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

  const typedToPng = (): string | null => {
    const name = typed.trim()
    if (!name) return null
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 160
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#102742'
    ctx.font = 'italic 64px "Brush Script MT","Snell Roundhand",cursive'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, 16, 88)
    return c.toDataURL('image/png')
  }

  const finish = () => {
    if (tab === 'type') {
      const png = typedToPng()
      if (!png) return
      onComplete(png)
      onOpenChange(false)
      return
    }
    if (!dirtyRef.current) return
    const png = canvasRef.current!.toDataURL('image/png')
    onComplete(png)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'draw' | 'type')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="type">Type</TabsTrigger>
          </TabsList>
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
          <TabsContent value="type" className="mt-3">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full name" autoFocus />
            <div className="mt-3 flex h-[120px] items-center justify-center rounded-md border border-border bg-white">
              <span style={{ fontFamily: '"Brush Script MT","Snell Roundhand",cursive', fontStyle: 'italic', fontSize: 44, color: '#102742' }}>
                {typed || 'Your name'}
              </span>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={finish}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
