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
  /**
   * Ryan Realty fix (SITE-112, 2026-09-16). The initial face is the REAL
   * VALUE, not 0.
   *
   * The catalog component seeds `display` at 0, so the server HTML and the
   * first client paint of every animated figure on this site published a zero:
   * "0 houses came on the market", and, once a fold carried a dollar figure,
   * "$0". A crawler, a reader with JavaScript off, and any snapshot taken
   * before the effect runs all read a number that is not the one the source
   * trace names, which CLAUDE.md section 0 does not allow at any weight.
   *
   * Seeding at `value` is hydration-safe by construction: the server and the
   * first client render produce the same string. The count-up is unchanged -
   * `fromRef` still starts at 0, so the effect animates 0 → value exactly as
   * the demo does, and reduced motion still lands on the finished number.
   */
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

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
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(display)}
    </span>
  );
}
