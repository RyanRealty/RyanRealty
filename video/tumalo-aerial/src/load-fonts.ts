/**
 * load-fonts — wires the canonical Amboqia Boriango loader for this project.
 *
 * Imported once at the top of src/index.ts (Remotion entry file).
 * This project had no font loader prior to 2026-05-20; the comps referenced
 * 'Amboqia Boriango' inline but the font was never registered. This module
 * makes that registration canonical and consistent with all other projects.
 *
 * Font file: video/tumalo-aerial/public/fonts/Amboqia_Boriango.otf
 */
import { loadAmboqia } from '../../../video_production_skills/captions/canonical/load-amboqia'

loadAmboqia()
