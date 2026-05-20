/**
 * load-fonts — wires the canonical Amboqia Boriango loader for this project.
 *
 * Imported once at the top of src/index.ts (Remotion entry file).
 * The project's brand/loadFonts.ts already handles Inter Display/Regular;
 * this module adds the canonical `loadAmboqia()` so that SingleWordCaption
 * components (Amboqia-based per the 2026-05-20 directive) render correctly.
 *
 * Font file: video/earnest/public/fonts/Amboqia_Boriango.otf
 */
import { loadAmboqia } from '../../../video_production_skills/captions/canonical/load-amboqia'

loadAmboqia()
