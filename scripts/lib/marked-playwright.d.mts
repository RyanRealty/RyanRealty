import type { BrowserContext } from 'playwright'
export { chromium, firefox, webkit, devices, errors } from 'playwright'
export declare function markContext(context: BrowserContext): Promise<BrowserContext>
declare const _default: {
  chromium: typeof import('playwright').chromium
  firefox: typeof import('playwright').firefox
  webkit: typeof import('playwright').webkit
  devices: typeof import('playwright').devices
  errors: typeof import('playwright').errors
}
export default _default
