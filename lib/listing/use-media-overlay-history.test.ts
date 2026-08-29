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
}: {
  open: boolean
  hash: 'gallery' | 'tour'
  onClose: () => void
  onDismiss: (dismiss: () => void) => void
}) {
  const { dismiss } = useMediaOverlayHistory(open, onClose, hash)
  React.useEffect(() => {
    onDismiss(dismiss)
  }, [dismiss, onDismiss])
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

  it('pushes #gallery when the overlay opens and dismiss uses history.back', async () => {
    const onClose = vi.fn()
    const pushSpy = vi.spyOn(history, 'pushState')
    const backSpy = vi.spyOn(history, 'back')
    let dismiss: (() => void) | null = null

    await act(async () => {
      root!.render(
        React.createElement(Harness, {
          open: true,
          hash: 'gallery',
          onClose,
          onDismiss: (fn) => {
            dismiss = fn
          },
        }),
      )
    })

    expect(pushSpy).toHaveBeenCalled()
    const url = String(pushSpy.mock.calls.at(-1)?.[2] ?? '')
    expect(url).toContain('#gallery')

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
})
