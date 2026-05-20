/**
 * Local re-export shim for SingleWordCaption.
 *
 * Resolves the React JSX type compatibility issue when TypeScript traverses
 * the cross-project canonical path. By re-exporting from within this project's
 * own module boundary, TypeScript uses the local node_modules/@types/react
 * rather than the canonical path's parent module resolution.
 *
 * This is the same pattern used in video/market-report-yt-long/src/KineticCaptions.tsx.
 */

export { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
export type { CaptionWord } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
