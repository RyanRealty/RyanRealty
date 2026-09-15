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
  /** Dual-thumb range on one track. Fill sits between the thumbs. */
  values?: readonly [number, number];
  onValuesChange?: (values: [number, number]) => void;
  /** Accessible name for the high thumb when `values` is set. */
  maxAriaLabel?: string;
}

export function RangeSlider({
  showTicks = true,
  className,
  values,
  onValuesChange,
  maxAriaLabel,
  ...options
}: RangeSliderProps) {
  if (values) {
    return (
      <DualTickRange
        values={values}
        onValuesChange={onValuesChange}
        min={options.min}
        max={options.max}
        step={options.step}
        showTicks={showTicks}
        className={className}
        formatValueText={options.formatValueText}
        minLabel={options["aria-label"] ?? "Minimum ask"}
        maxLabel={maxAriaLabel ?? "Maximum ask"}
        disabled={options.disabled}
      />
    );
  }

  return <SingleTickRange showTicks={showTicks} className={className} {...options} />;
}

function SingleTickRange({
  showTicks = true,
  className,
  ...options
}: SliderOptions & { showTicks?: boolean; className?: string }) {
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
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-primary/15",
        TOUCH_GESTURE_CLASS,
        options.disabled
          ? "pointer-events-none opacity-50"
          : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg">
        <div
          className="absolute inset-y-0 left-0 rounded-lg bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
        <motion.div className="absolute inset-0 rounded-lg bg-primary/40" style={{ x: fillX }} />
      </div>

      {/* Tick centres follow the same inset path as the handle centre. */}
      <div className="pointer-events-none absolute inset-x-[10px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - min) / (max - min)) * 100;
          return (
            <span
              key={t}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50"
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
        className="absolute left-0 top-1/2 h-6 w-1 rounded-full bg-primary outline-none ring-inset ring-primary/30 focus-visible:ring-4"
        style={{ x: thumbX, y: "-50%" }}
      />
    </div>
  );
}

type DualTickRangeProps = {
  values: readonly [number, number];
  onValuesChange?: (values: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  showTicks?: boolean;
  className?: string;
  formatValueText?: (value: number) => string;
  minLabel: string;
  maxLabel: string;
  disabled?: boolean;
};

function DualTickRange({
  values,
  onValuesChange,
  min = 0,
  max = 100,
  step = 1,
  showTicks = true,
  className,
  formatValueText,
  minLabel,
  maxLabel,
  disabled = false,
}: DualTickRangeProps) {
  const reduce = useReducedMotion();
  const loBound = min;
  const hiBound = max > min ? max : min;
  const stride = step > 0 ? step : 1;
  const pair = values[0] <= values[1] ? values : [values[1], values[0]] as const;
  const lo = Math.min(Math.max(pair[0], loBound), hiBound);
  const hi = Math.min(Math.max(pair[1], loBound), hiBound);
  const span = hiBound - loBound;
  const loPct = span > 0 ? ((lo - loBound) / span) * 100 : 0;
  const hiPct = span > 0 ? ((hi - loBound) / span) * 100 : 0;
  const [trackWidth, setTrackWidth] = useState(292);
  const [active, setActive] = useState<"lo" | "hi" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const loEl = useRef<HTMLElement | null>(null);
  const hiEl = useRef<HTMLElement | null>(null);
  const activeRef = useRef<"lo" | "hi" | null>(null);

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

  const loTarget = useMotionValue(loPct);
  const hiTarget = useMotionValue(hiPct);
  useEffect(() => {
    loTarget.set(loPct);
    hiTarget.set(hiPct);
  }, [hiPct, hiTarget, loPct, loTarget]);
  const loSpring = useSpring(loTarget, SPRING_GLIDE);
  const hiSpring = useSpring(hiTarget, SPRING_GLIDE);
  const loPos = reduce ? loTarget : loSpring;
  const hiPos = reduce ? hiTarget : hiSpring;
  const travel = Math.max(0, trackWidth - 20);
  const loThumbX = useTransform(loPos, (p) => 8 + travel * p / 100);
  const hiThumbX = useTransform(hiPos, (p) => 8 + travel * p / 100);

  const commitFromX = useCallback(
    (clientX: number, which: "lo" | "hi") => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = loBound + ratio * (hiBound - loBound);
      const snapped = snapSliderValue(raw, loBound, hiBound, stride);
      if (which === "lo") {
        onValuesChange?.([Math.min(snapped, hi), hi]);
      } else {
        onValuesChange?.([lo, Math.max(snapped, lo)]);
      }
    },
    [hi, hiBound, lo, loBound, onValuesChange, stride],
  );

  const pickThumb = useCallback(
    (clientX: number): "lo" | "hi" => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return "hi";
      const x = clientX - rect.left;
      const loX = 8 + travel * loPct / 100;
      const hiX = 8 + travel * hiPct / 100;
      return Math.abs(x - loX) <= Math.abs(x - hiX) ? "lo" : "hi";
    },
    [hiPct, loPct, travel],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const which = pickThumb(event.clientX);
      activeRef.current = which;
      setActive(which);
      capturePointer(event.currentTarget, event.pointerId);
      (which === "lo" ? loEl : hiEl).current?.focus({ preventScroll: true });
      commitFromX(event.clientX, which);
    },
    [commitFromX, disabled, pickThumb],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const which = activeRef.current;
      if (!which || disabled) return;
      commitFromX(event.clientX, which);
    },
    [commitFromX, disabled],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    releasePointer(event.currentTarget, event.pointerId);
    activeRef.current = null;
    setActive(null);
  }, []);

  const steps = Math.floor(Number(((hiBound - loBound) / stride).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) => Number((loBound + i * stride).toFixed(6)))
      : [];

  const keyMove = useCallback(
    (which: "lo" | "hi", next: number) => {
      const snapped = snapSliderValue(next, loBound, hiBound, stride);
      if (which === "lo") onValuesChange?.([Math.min(snapped, hi), hi]);
      else onValuesChange?.([lo, Math.max(snapped, lo)]);
    },
    [hi, hiBound, lo, loBound, onValuesChange, stride],
  );

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-visible rounded-lg bg-primary/15",
        TOUCH_GESTURE_CLASS,
        disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg">
        <div
          className="absolute inset-y-0 rounded-lg bg-primary"
          style={{
            left: `${Math.max(0, Math.min(100, loPct))}%`,
            width: `${Math.max(0, Math.min(100, hiPct - loPct))}%`,
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-[10px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - loBound) / (hiBound - loBound)) * 100;
          return (
            <span
              key={t}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/80"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>
      <motion.div
        ref={(node) => {
          loEl.current = node;
        }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={minLabel}
        aria-valuemin={loBound}
        aria-valuemax={hi}
        aria-valuenow={lo}
        aria-valuetext={formatValueText?.(lo)}
        animate={reduce ? undefined : { scaleY: active === "lo" ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="absolute left-0 top-1/2 h-6 w-1.5 rounded-full bg-background outline-none ring-2 ring-primary focus-visible:ring-4"
        style={{ x: loThumbX, y: "-50%" }}
        onKeyDown={(event) => {
          const map: Record<string, number> = {
            ArrowRight: lo + stride,
            ArrowUp: lo + stride,
            ArrowLeft: lo - stride,
            ArrowDown: lo - stride,
            Home: loBound,
            End: hi,
          };
          if (event.key in map) {
            event.preventDefault();
            keyMove("lo", map[event.key] ?? lo);
          }
        }}
      />
      <motion.div
        ref={(node) => {
          hiEl.current = node;
        }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={maxLabel}
        aria-valuemin={lo}
        aria-valuemax={hiBound}
        aria-valuenow={hi}
        aria-valuetext={formatValueText?.(hi)}
        animate={reduce ? undefined : { scaleY: active === "hi" ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="absolute left-0 top-1/2 h-6 w-1.5 rounded-full bg-background outline-none ring-2 ring-primary focus-visible:ring-4"
        style={{ x: hiThumbX, y: "-50%" }}
        onKeyDown={(event) => {
          const map: Record<string, number> = {
            ArrowRight: hi + stride,
            ArrowUp: hi + stride,
            ArrowLeft: hi - stride,
            ArrowDown: hi - stride,
            Home: lo,
            End: hiBound,
          };
          if (event.key in map) {
            event.preventDefault();
            keyMove("hi", map[event.key] ?? hi);
          }
        }}
      />
    </div>
  );
}
