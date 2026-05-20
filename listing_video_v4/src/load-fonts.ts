/**
 * load-fonts — wires the canonical Amboqia Boriango loader for this project.
 *
 * Imported once at the top of src/index.ts (Remotion entry file).
 * The project's own fonts.ts already loads Amboqia via an inline @font-face
 * CSS string; this module additionally registers the font via the canonical
 * `loadAmboqia()` helper so SingleWordCaption components work correctly
 * regardless of which load path fires first.
 *
 * Font file: listing_video_v4/public/fonts/Amboqia_Boriango.otf (already present)
 */
import { loadAmboqia } from '../../video_production_skills/captions/canonical/load-amboqia'

loadAmboqia()
