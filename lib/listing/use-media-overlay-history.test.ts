/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useMediaOverlayHistory } from './use-media-overlay-history'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness({
  open,
  hash,
  onClose,
  onDismiss,
  onCloseInPlace,
  photo,
}: {
  open: boolean
  hash: 'gallery' | 'tour'
  onClose: () => void
  onDismiss: (dismiss: () => void) => void
  onCloseInPlace?: (fn: () => void) => void
  photo?: number | null
}) {
  const { dismiss, closeInPlace } = useMediaOverlayHistory(open, onClose, hash, photo)
  React.useEffect(() => {
    onDismiss(dismiss)
    onCloseInPlace?.(closeInPlace)
  }, [dismiss, closeInPlace, onDismiss, onCloseInPlace])
  return null
}

describe('useMediaOverlayHistory', () => {
  let container: HTMLDivElement
  let root: Root | null = null

  beforeEach(() => {
    window.history.replaceState(null, '', '/homes-for-sale/listing/220226009')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) {
      act(() => root!.unmount())
      root = null
    }
    container.remove()
  })

  it('pushes ?photo=1 when the gallery opens and dismiss uses history.back', async () => {
    const onClose = vi.fn()
    const pushSpy = vi.spyOn(history, 'pushState')
    const backSpy = vi.spyOn(history, 'back')
    let dismiss: (() => void) | null = null

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          photo: 1,
          onClose,
          onDismiss: (fn) => {
            dismiss = fn
          },
        }),
      )
    })

    expect(pushSpy).toHaveBeenCalled()
    const url = String(pushSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(url).toContain('photo=1')
    expect(url).not.toContain('#gallery')

    await act(async () => {
      dismiss?.()
    })
    expect(backSpy).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    pushSpy.mockRestore()
    backSpy.mockRestore()
  })

  it('closes on popstate so browser Back does not leave the listing', async () => {
    const onClose = vi.fn()

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'tour',
          onClose,
          onDismiss: () => {},
        }),
      )
    })

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('tour overlay still writes #tour', async () => {
    const pushSpy = vi.spyOn(history, 'pushState')

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'tour',
          onClose: vi.fn(),
          onDismiss: () => {},
        }),
      )
    })

    const url = String(pushSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(url).toContain('#tour')
    pushSpy.mockRestore()
  })

  it('does not write #tour when gallery is open without a photo index', async () => {
    const pushSpy = vi.spyOn(history, 'pushState')
    const replaceSpy = vi.spyOn(history, 'replaceState')

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          photo: 1,
          onClose: vi.fn(),
          onDismiss: () => {},
        }),
      )
    })

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          photo: null,
          onClose: vi.fn(),
          onDismiss: () => {},
        }),
      )
    })

    const dests = [
      ...pushSpy.mock.calls.map((c) => String(c[2] ?? '')),
      ...replaceSpy.mock.calls.map((c) => String(c[2] ?? '')),
    ]
    expect(dests.some((d) => d.includes('#tour'))).toBe(false)
    const lastReplace = String(replaceSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(lastReplace).not.toContain('#tour')
    expect(lastReplace).not.toMatch(/[?&]photo=/)
    pushSpy.mockRestore()
    replaceSpy.mockRestore()
  })

  it('occupies history for a floor-pane gallery without #tour', async () => {
    const pushSpy = vi.spyOn(history, 'pushState')
    const replaceSpy = vi.spyOn(history, 'replaceState')

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          photo: null,
          onClose: vi.fn(),
          onDismiss: () => {},
        }),
      )
    })

    expect(pushSpy).toHaveBeenCalled()
    const dest = String(pushSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(dest).not.toContain('#tour')
    expect(dest).not.toMatch(/[?&]photo=/)
    const replaceTours = replaceSpy.mock.calls.filter((c) => String(c[2] ?? '').includes('#tour'))
    expect(replaceTours).toHaveLength(0)
    pushSpy.mockRestore()
    replaceSpy.mockRestore()
  })

  it('closeInPlace strips photo without history.back', async () => {
    const onClose = vi.fn()
    const backSpy = vi.spyOn(history, 'back')
    const replaceSpy = vi.spyOn(history, 'replaceState')
    let closeInPlace: (() => void) | null = null

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          photo: 1,
          onClose,
          onDismiss: () => {},
          onCloseInPlace: (fn) => {
            closeInPlace = fn
          },
        }),
      )
    })

    await act(async () => {
      closeInPlace?.()
    })

    expect(backSpy).not.toHaveBeenCalled()
    const dest = String(replaceSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(dest).not.toMatch(/[?&]photo=/)
    expect(dest).not.toContain('#tour')
    expect(onClose).toHaveBeenCalledTimes(1)
    backSpy.mockRestore()
    replaceSpy.mockRestore()
  })
})
