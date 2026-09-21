"use client";
// beui.dev/components/motion/range-slider

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { SPRING_GLIDE } from "@/lib/ease";
import { snapSliderValue, type SliderOptions, useSlider } from "@/lib/hooks/use-slider";
import { capturePointer, releasePointer, TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Bouncy grab feedback for the thumb scale only.
const SPRING_BOUNCY = { type: "spring", stiffness: 500, damping: 14, mass: 0.7 } as const;

export interface RangeSliderProps extends SliderOptions {
  /** Render a tick dot at each step. */
  showTicks?: boolean;
  className?: string;
}

export function RangeSlider({ showTicks = true, className, ...options }: RangeSliderProps) {
  const reduce = useReducedMotion();
  const { percent, dragging, min, max, step, trackProps, sliderProps } = useSlider(options);
  const [trackWidth, setTrackWidth] = useState(292);
  useLayoutEffect(() => {
    const track = trackProps.ref.current;
    if (!track) return;
    const measure = () => {
      const width = track.getBoundingClientRect().width;
      if (width > 0) setTrackWidth(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [trackProps.ref]);

  // Spring-smoothed position drives both the thumb and the fill.
  const target = useMotionValue(percent);
  useEffect(() => {
    target.set(percent);
  }, [percent, target]);
  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const thumbX = useTransform(pos, (p) => 8 + Math.max(0, trackWidth - 20) * p / 100);
  // Match InlineSlider: the 4px handle starts 8px inside the track, and
  // the rounded fill extends 8px past its left edge. Translate a full-size
  // fill inside the 2px inset clip so its corner never stretches.
  const fillX = useTransform(pos, (p) => p >= 100
    ? "0%"
    : `calc(${p - 100}% + ${14 - 0.16 * p}px)`);

  // Floor rather than round, so a range the step does not divide (0 to 10 by 4)
  // stops its dots at the last whole step instead of drawing one past max.
  // toFixed comes first because 0.3/0.1 is 2.9999999999999996, which would
  // floor to 2 and drop the last dot.
  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) => Number((min + i * step).toFixed(6)))
      : [];

  return (
    <div
      {...trackProps}
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-muted",
        TOUCH_GESTURE_CLASS,
        options.disabled
          ? "pointer-events-none opacity-50"
          : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg">
        <motion.div className="absolute inset-0 rounded-lg bg-foreground/15" style={{ x: fillX }} />
      </div>

      {/* Tick centres follow the same inset path as the handle centre. */}
      <div className="pointer-events-none absolute inset-x-[10px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - min) / (max - min)) * 100;
          return (
            <span
              key={t}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>

      {/* Keep the handle inside the rounded progress fill at both ends. */}
      <motion.div
        {...sliderProps}
        animate={reduce ? undefined : { scaleY: dragging ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="absolute left-0 top-1/2 h-6 w-1 rounded-full bg-foreground outline-none ring-inset ring-foreground/30 focus-visible:ring-4"
        style={{ x: thumbX, y: "-50%" }}
      />
    </div>
  );
}

const HANDLE_START = 8;
const HANDLE_TRAVEL_INSET = 20;

export function pickDualThumb(x: number, loX: number, hiX: number): "lo" | "hi" {
  if (!(Number.isFinite(x) && Number.isFinite(loX) && Number.isFinite(hiX))) return "lo";
  if (loX === hiX) return x < loX ? "lo" : "hi";
  return Math.abs(x - loX) <= Math.abs(x - hiX) ? "lo" : "hi";
}

export function clampDualValue(
  which: "lo" | "hi",
  next: number,
  lo: number,
  hi: number,
): [number, number] {
  if (which === "lo") return [Math.min(next, hi), hi];
  return [lo, Math.max(next, lo)];
}

export interface DualRangeSliderProps extends Omit<SliderOptions, "value" | "defaultValue" | "onValueChange"> {
  values: [number, number];
  onValuesChange?: (values: [number, number]) => void;
  /** Pointer-up / keyboard — once per gesture. */
  onValuesCommit?: (values: [number, number]) => void;
  showTicks?: boolean;
  className?: string;
  minAriaLabel?: string;
  maxAriaLabel?: string;
}

/**
 * Same catalog track as RangeSlider — tick dots, vertical-bar thumbs, bounce
 * on grab, reduced-motion safe — with two thumbs and fill between them.
 * Price min/max is this object, not two stacked single sliders.
 */
export function DualRangeSlider({
  showTicks = true,
  className,
  values,
  onValuesChange,
  onValuesCommit,
  minAriaLabel = "Minimum",
  maxAriaLabel = "Maximum",
  ...options
}: DualRangeSliderProps) {
  const reduce = useReducedMotion();
  const min = options.min ?? 0;
  const max = options.max != null && options.max > min ? options.max : min;
  const step = options.step && options.step > 0 ? options.step : 1;
  const disabled = options.disabled === true;
  const lo = Math.min(values[0], values[1]);
  const hi = Math.max(values[0], values[1]);
  const span = max > min ? max - min : 1;
  const loPercent = max > min ? ((lo - min) / span) * 100 : 0;
  const hiPercent = max > min ? ((hi - min) / span) * 100 : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const loEl = useRef<HTMLElement | null>(null);
  const hiEl = useRef<HTMLElement | null>(null);
  const draggingWhich = useRef<"lo" | "hi" | null>(null);
  const valuesRef = useRef<[number, number]>([lo, hi]);
  const pendingRef = useRef<[number, number]>([lo, hi]);
  const onValuesChangeRef = useRef(onValuesChange);
  const onValuesCommitRef = useRef(onValuesCommit);
  valuesRef.current = [lo, hi];
  if (!draggingWhich.current) pendingRef.current = [lo, hi];
  onValuesChangeRef.current = onValuesChange;
  onValuesCommitRef.current = onValuesCommit;

  const [trackWidth, setTrackWidth] = useState(292);
  const [dragging, setDragging] = useState<"lo" | "hi" | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const width = track.getBoundingClientRect().width;
      if (width > 0) setTrackWidth(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const travel = Math.max(0, trackWidth - HANDLE_TRAVEL_INSET);
  const loX = HANDLE_START + travel * loPercent / 100;
  const hiX = HANDLE_START + travel * hiPercent / 100;
  const loTarget = useMotionValue(loX);
  const hiTarget = useMotionValue(hiX);
  useEffect(() => {
    loTarget.set(loX);
  }, [loX, loTarget]);
  useEffect(() => {
    hiTarget.set(hiX);
  }, [hiX, hiTarget]);
  const loSmooth = useSpring(loTarget, SPRING_GLIDE);
  const hiSmooth = useSpring(hiTarget, SPRING_GLIDE);
  const loThumbX = reduce ? loTarget : loSmooth;
  const hiThumbX = reduce ? hiTarget : hiSmooth;

  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) => Number((min + i * step).toFixed(6)))
      : [];

  const valueFromClientX = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (rect.width <= 0) return min;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return min + ratio * (max - min);
    },
    [min, max],
  );

  const commitWhich = useCallback(
    (which: "lo" | "hi", raw: number) => {
      const clean = snapSliderValue(raw, min, max, step);
      const [curLo, curHi] = valuesRef.current;
      const next = clampDualValue(which, clean, curLo, curHi);
      pendingRef.current = next;
      if (next[0] === curLo && next[1] === curHi) return;
      onValuesChangeRef.current?.(next);
    },
    [min, max, step],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) return;
      const track = event.currentTarget;
      const rect = track.getBoundingClientRect();
      if (!rect.width) return;
      const loX = HANDLE_START + travel * loPercent / 100;
      const hiX = HANDLE_START + travel * hiPercent / 100;
      const which = pickDualThumb(event.clientX - rect.left, loX, hiX);
      draggingWhich.current = which;
      commitWhich(which, valueFromClientX(event.clientX, rect));
      setDragging(which);
      capturePointer(track, event.pointerId);
      (which === "lo" ? loEl : hiEl).current?.focus({ preventScroll: true });
    },
    [disabled, travel, loPercent, hiPercent, commitWhich, valueFromClientX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const which = draggingWhich.current;
      if (!which || disabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      commitWhich(which, valueFromClientX(event.clientX, rect));
    },
    [disabled, commitWhich, valueFromClientX],
  );

  const finishGesture = useCallback(() => {
    if (!draggingWhich.current) return;
    const next = pendingRef.current;
    draggingWhich.current = null;
    setDragging(null);
    onValuesCommitRef.current?.(next);
  }, []);

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    releasePointer(event.currentTarget, event.pointerId);
    finishGesture();
  }, [finishGesture]);

  useEffect(() => {
    if (!dragging) return;
    const up = () => finishGesture();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, finishGesture]);

  const onKey = (which: "lo" | "hi") => (event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const [curLo, curHi] = valuesRef.current;
    const current = which === "lo" ? curLo : curHi;
    const map: Record<string, number> = {
      ArrowRight: current + step,
      ArrowUp: current + step,
      ArrowLeft: current - step,
      ArrowDown: current - step,
      PageUp: current + step * 10,
      PageDown: current - step * 10,
      Home: min,
      End: max,
    };
    if (event.key in map) {
      event.preventDefault();
      commitWhich(which, map[event.key]!);
      onValuesCommitRef.current?.(pendingRef.current);
    }
  };

  const thumbClass =
    "absolute left-0 top-1/2 h-6 w-1 rounded-full bg-foreground outline-none ring-inset ring-foreground/30 focus-visible:ring-4";

  return (
    <div
      ref={trackRef}
      data-beui-range="dual"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-muted",
        TOUCH_GESTURE_CLASS,
        disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg">
        <motion.div
          data-beui-fill=""
          className="absolute inset-y-0 rounded-lg bg-foreground/15"
          style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-[10px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - min) / (max - min)) * 100;
          return (
            <span
              key={t}
              data-beui-tick=""
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>

      <motion.div
        ref={(node) => {
          loEl.current = node;
        }}
        data-beui-thumb="min"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={minAriaLabel}
        aria-valuemin={min}
        aria-valuemax={hi}
        aria-valuenow={lo}
        aria-valuetext={options.formatValueText?.(lo)}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        onKeyDown={onKey("lo")}
        animate={reduce ? undefined : { scaleY: dragging === "lo" ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className={cn(thumbClass, dragging === "lo" ? "z-20" : "z-10")}
        style={{ x: loThumbX, y: "-50%" }}
      />
      <motion.div
        ref={(node) => {
          hiEl.current = node;
        }}
        data-beui-thumb="max"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={maxAriaLabel}
        aria-valuemin={lo}
        aria-valuemax={max}
        aria-valuenow={hi}
        aria-valuetext={options.formatValueText?.(hi)}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        onKeyDown={onKey("hi")}
        animate={reduce ? undefined : { scaleY: dragging === "hi" ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className={cn(thumbClass, dragging === "hi" ? "z-20" : "z-10")}
        style={{ x: hiThumbX, y: "-50%" }}
      />
    </div>
  );
}
