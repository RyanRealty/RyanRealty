"use client";
// beui.dev/components/motion/number

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  startOnView?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 1.2,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = true,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // amount 0.15: fold numerals (claim, MOS bars, alerts) are often <60% of a
  // short mobile plate — 0.6 left them stuck at the initial 0 (SITE-73 honesty).
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  // THE SERVER RENDERS THE SETTLED FIGURE, NEVER THE WHEEL'S START. The beui
  // original seeds `useState(0)`, so the served HTML — what a crawler, a no-JS
  // reader, and anyone on a slow connection gets — read "0 houses came on the
  // market" under a source line naming 256 (SITE-117, found on /cities
  // 2026-09-16). A zero for a count that is 256 is a wrong number, not a
  // placeholder (CLAUDE.md §0). The hydration pass renders the same figure, so
  // the DOM never mismatches; the count-up is arranged below, client-only.
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const rewoundRef = useRef(false);

  // Rewind to the wheel's start once, after hydration and BEFORE the browser
  // paints, so the count-up still runs from 0 on screen without a settled →
  // 0 flash between two painted frames. Reduced motion never rewinds: the
  // finished number is already in the DOM and stays.
  useLayoutEffect(() => {
    if (rewoundRef.current) return;
    rewoundRef.current = true;
    if (reduce) return;
    setDisplay(0);
  }, [reduce]);

  useEffect(() => {
    if (startOnView && !inView) return;
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
    // data-value carries the settled figure beside the face so a served page
    // can be checked mechanically: a face of "0" under a non-zero data-settled is
    // the placeholder coming back (scripts/lib/served-number-placeholder.mjs,
    // run by ci:route-smoke).
    <span ref={ref} className={cn("tabular-nums", className)} data-settled={value}>
      {format(display)}
    </span>
  );
}
