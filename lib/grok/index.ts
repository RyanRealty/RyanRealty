/**
 * lib/grok — every Grok capability behind one import.
 * Replaces the three ad-hoc lib/grok-*.ts files (kept as shims).
 *
 * reachability: entry-point — public API barrel for the lib/grok package.
 * Callers still reach the modules through the shims, so nothing imports the
 * facade yet; it is the destination of that migration, not dead code. Drop this
 * marker once callers import from '@/lib/grok' directly.
 */
export {
  GROK_MODELS,
  GROK_RATES,
  GrokError,
  ticksToUsd,
  XAI_BASE_URL,
  grokApiKey,
  grokConfigured,
  xaiFetch,
  type GrokModel,
} from './client'
export {
  generateGrokText,
  generateGrokStructured,
  parseJsonLoose,
  type GrokMessage,
  type GrokTextOptions,
  type GrokTextResult,
  type GrokSearchTool,
  type GrokSearchOptions,
  searchGrok,
} from './text'
export {
  generateGrokImage,
  generateGrokImages,
  editGrokImage,
  type GrokAspect,
  type GrokResolution,
  type GrokImageEditOptions,
  type GrokImageOptions,
  type GrokImageResult,
} from './image'
export {
  generateGrokVideo,
  isTempGrokUrl,
  type GrokVideoAspect,
  type GrokVideoOptions,
  type GrokVideoResolution,
  type GrokVideoResult,
  type GrokVideoSource,
} from './video'
export {
  inspectFrame,
  normalizeVerdict,
  FRAME_DEFECTS,
  type FrameDefect,
  type VisionQaInput,
  type VisionVerdict,
} from './vision'
