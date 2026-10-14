# Pins pop onto a map, one per real record

Source: Matt 2026-10-13 buyer ad: price drops and concessions on the map, then the overlap
Category: scene

Planned: not on the menu yet (video_gate refuses it). Home when built: lib/studio/motion/pins.ts.

## Recipe
Real records land as pins on the map, each at its own coordinates, eased in with a small overshoot, a second layer lighting where a second condition also holds (the buyer ad: price cuts, then concessions, then the homes with both). Every pin is a row; the count on screen is the pin count.

## Use
List `map_pins_pop` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
