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
   * Default true (visibility audit 2026-09-22; was opt-in under SITE-103).
   * Render the sourced value immediately, on the server and at first paint,
   * and animate only when the value CHANGES afterwards.
   *
   * Two reasons, both rules rather than taste. With the beui default the
   * server-rendered face is `format(0)`, so a market page ships "$0 median list
   * price" and "0 homes for sale" in its HTML and only becomes true after
   * hydration: a figure that is wrong until JavaScript runs, in front of a
   * crawler and a reader with a slow connection (CLAUDE.md section 0). On
   * 2026-09-22 production HTML for /, city, neighborhood and subdivision pages
   * carried "$0 median list price", "houses for sale 0" and "the 0 homes for
   * sale in {plat}" because five direct call sites never passed the opt-in.
   * And TASTE.md bans numbers counting up on load as decoration. What is left
   * is the half of the beui demo that carries data: digits that move because
   * the reader moved something. Pass `false` only for a decorative count-up
   * that is not a published figure.
   */
  settleOnMount?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 1.2,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = true,
  settleOnMount = true,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // amount 0.15: fold numerals (claim, MOS bars, alerts) are often <60% of a
  // short mobile plate — 0.6 left them stuck at the initial 0 (SITE-73 honesty).
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(settleOnMount ? value : 0);
  const fromRef = useRef(settleOnMount ? value : 0);

  useEffect(() => {
    if (startOnView && !inView) return;
    if (fromRef.current === value) return;
    if (reduce) {
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
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(display)}
    </span>
  );
}
