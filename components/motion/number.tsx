"use client";
// beui.dev/components/motion/number

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  startOnView?: boolean;
  /**
   * Accepted for callers that opted in before 2026-09-16 (SITE-103) and now
   * always true: the face is the sourced value on the server and at first
   * paint, and digits move only when the value CHANGES afterwards. See the
   * note on `display` below for why there is no other mode.
   */
  settleOnMount?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 1.2,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility; the behaviour it asked for is the only one now
  settleOnMount: _settleOnMount,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // amount 0.15: fold numerals (claim, MOS bars, alerts) are often <60% of a
  // short mobile plate — 0.6 left them stuck at the initial 0 (SITE-73 honesty).
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  // THE FACE IS THE SOURCED VALUE FROM THE FIRST BYTE. The beui original
  // seeded `useState(0)`, so the served HTML — what a crawler, a no-JS reader
  // and anyone on a slow connection gets — read "0 houses came on the market"
  // under a source line naming 256 (SITE-117, /cities, 2026-09-16) and "$0
  // median list price" on a market page (SITE-103). A zero for a count that
  // is 256 is a wrong number, not a placeholder (CLAUDE.md §0). And TASTE.md
  // bans numbers counting up on load as decoration, so there is no rewind: the
  // hydration pass renders the same figure, and the wheel turns only when the
  // value changes because the reader moved something — the half of the beui
  // demo that carries data.
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (fromRef.current === value) return;
    // A change while the numeral is off screen (or under reduced motion)
    // settles without a wheel: the finished number is what the reader meets.
    if ((startOnView && !inView) || reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, inView, startOnView, reduce]);

  return (
    // data-settled carries the sourced figure beside the face so a served page
    // can be checked mechanically: a face of "0" under a non-zero data-settled
    // is the placeholder coming back (scripts/lib/served-number-placeholder.mjs,
    // run by ci:route-smoke).
    <span ref={ref} className={cn("tabular-nums", className)} data-settled={value}>
      {format(display)}
    </span>
  );
}
