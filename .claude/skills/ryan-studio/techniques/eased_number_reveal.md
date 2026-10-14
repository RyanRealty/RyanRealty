# Eased number reveal

Source: RULEBOOK 2b (calm eased entrances, 2026-10-09)

## Recipe
One hero number per beat. Remotion: spring({fps:30, config:{damping:200}}) on scale 0.92->1 and opacity 0->1 over 12 frames; then 2% slow drift (interpolate translateY 0->-8px across the hold). Hold >= 2.5 s. Number has a brief.numbers row.

## Use
List `eased_number_reveal` in brief.techniques. Mandatory spec_rules still apply.
