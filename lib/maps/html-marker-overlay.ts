/**
 * HTML OverlayView markers for Google Maps (price pills / photo stamps).
 * Lazy-built after the Maps script loads. Compatible with MarkerClusterer
 * (setMap, getPosition, getVisible, click → Maps event).
 */

export type HtmlMarkerOverlayHandle = {
  content: HTMLElement
  zIndex: number
  setMap(map: google.maps.Map | null): void
  getPosition(): google.maps.LatLng
  getVisible(): boolean
  getMap(): google.maps.Map | null | undefined
}

export type HtmlMarkerOverlayOptions = {
  position: google.maps.LatLng | google.maps.LatLngLiteral
  content: HTMLElement
  map?: google.maps.Map | null
  title?: string
  zIndex?: number
  onClick?: (ev: MouseEvent) => void
  /** Anchor: bottom-center (default) for pins that sit on the lat/lng. */
  anchor?: 'bottom-center' | 'center'
}

type Ctor = new (opts: HtmlMarkerOverlayOptions) => HtmlMarkerOverlayHandle

let HtmlMarkerOverlayClass: Ctor | null = null

export function getHtmlMarkerOverlayClass(): Ctor {
  if (HtmlMarkerOverlayClass) return HtmlMarkerOverlayClass

  class HtmlMarkerOverlay extends google.maps.OverlayView {
    private container: HTMLDivElement | null = null
    private contentEl: HTMLElement
    private latLng: google.maps.LatLng
    private zIndexValue: number
    private titleText: string
    private onClick?: (ev: MouseEvent) => void
    private anchor: 'bottom-center' | 'center'

    constructor(opts: HtmlMarkerOverlayOptions) {
      super()
      this.contentEl = opts.content
      this.latLng =
        opts.position instanceof google.maps.LatLng
          ? opts.position
          : new google.maps.LatLng(opts.position)
      this.zIndexValue = opts.zIndex ?? 1
      this.titleText = opts.title ?? ''
      this.onClick = opts.onClick
      this.anchor = opts.anchor ?? 'bottom-center'
      if (opts.map) this.setMap(opts.map)
    }

    onAdd() {
      const div = document.createElement('div')
      div.style.position = 'absolute'
      div.style.transform =
        this.anchor === 'center' ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)'
      div.style.zIndex = String(this.zIndexValue)
      div.style.cursor = 'pointer'
      if (this.titleText) div.title = this.titleText
      div.appendChild(this.contentEl)
      div.addEventListener('click', (ev) => {
        ev.stopPropagation()
        this.onClick?.(ev)
        google.maps.event.trigger(this, 'click', ev)
      })
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(div)
      this.getPanes()?.overlayMouseTarget.appendChild(div)
      this.container = div
    }

    draw() {
      const div = this.container
      if (!div) return
      const proj = this.getProjection()
      if (!proj) return
      const pt = proj.fromLatLngToDivPixel(this.latLng)
      if (!pt) return
      div.style.left = `${pt.x}px`
      div.style.top = `${pt.y}px`
    }

    onRemove() {
      this.container?.remove()
      this.container = null
    }

    get content(): HTMLElement {
      return this.contentEl
    }
    set content(el: HTMLElement) {
      if (this.container) this.contentEl.replaceWith(el)
      this.contentEl = el
    }
    get zIndex(): number {
      return this.zIndexValue
    }
    set zIndex(z: number) {
      this.zIndexValue = z
      if (this.container) this.container.style.zIndex = String(z)
    }
    getPosition(): google.maps.LatLng {
      return this.latLng
    }
    getVisible(): boolean {
      return true
    }
  }

  HtmlMarkerOverlayClass = HtmlMarkerOverlay as unknown as Ctor
  return HtmlMarkerOverlayClass
}

/** Compact navy price pill for mid-zoom place maps. */
export function buildPricePillElement(priceLabel: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'background:#102742',
    'color:#faf8f4',
    'font:700 11px/1.2 system-ui,-apple-system,sans-serif',
    'padding:5px 8px',
    'border-radius:999px',
    'border:2px solid #faf8f4',
    'box-shadow:0 2px 8px rgba(16,39,66,0.35)',
    'white-space:nowrap',
    'font-variant-numeric:tabular-nums',
  ].join(';')
  el.textContent = priceLabel
  return el
}
