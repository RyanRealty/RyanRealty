"use client";
// beui.dev/components/motion/scroll-animation

import type Lenis from "lenis";
import { ReactLenis, useLenis } from "lenis/react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

// Lenis' own expo-out curve — the canonical smooth-scroll easing. Kept as a
// named local fn (not a lib/ease token) because tokens are bezier control
// points for the motion lib, while Lenis needs a (t) => number easing fn.
const EASE_SCROLL = (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t));

export type ScrollTarget = number | string | HTMLElement;

export type ScrollToOptions = {
  offset?: number;
  immediate?: boolean;
  duration?: number;
};

export type SmoothScrollApi = {
  /** Underlying Lenis instance, or null on the reduced-motion / native path. */
  lenis: Lenis | null;
  /** Current scroll offset in px. */
  scrollY: MotionValue<number>;
  /** Scroll position as 0..1 of the scrollable height. */
  progress: MotionValue<number>;
  /** Signed scroll velocity (px/frame); drives velocity-based effects. */
  velocity: MotionValue<number>;
  /** Programmatic smooth scroll. Respects reduced motion (jumps instantly). */
  scrollTo: (target: ScrollTarget, options?: ScrollToOptions) => void;
};

const SmoothScrollContext = createContext<SmoothScrollApi | null>(null);

export interface SmoothScrollProps {
  children: ReactNode;
  /** Drive the page (window) when true, or a contained scroll area when false. */
  root?: boolean;
  /** Smoothing factor; lower is smoother and heavier. */
  lerp?: number;
  /** Wheel / programmatic ease duration in seconds. */
  duration?: number;
  orientation?: "vertical" | "horizontal";
  /** Wheel scroll speed multiplier. */
  wheelMultiplier?: number;
  /** Smooth touch scrolling. Off by default — native momentum is good on mobile. */
  touch?: boolean;
  className?: string;
}

type ScrollSource = Window | HTMLElement;

function readMetrics(target: ScrollSource) {
  if (target instanceof Window) {
    const max = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    return { y: window.scrollY, max };
  }
  return {
    y: target.scrollTop,
    max: Math.max(0, target.scrollHeight - target.clientHeight),
  };
}

function resolveTop(
  target: ScrollTarget,
  source: ScrollSource,
  offset = 0,
): number {
  if (typeof target === "number") return target + offset;
  if (source instanceof Window) {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return window.scrollY;
    return el.getBoundingClientRect().top + window.scrollY + offset;
  }
  const el =
    typeof target === "string" ? source.querySelector(target) : target;
  if (!(el instanceof HTMLElement)) return source.scrollTop;
  return el.offsetTop + offset;
}

/** Pushes Lenis' live scroll state into the shared motion values. */
function LenisBridge({
  scrollY,
  progress,
  velocity,
  lenisRef,
}: {
  scrollY: MotionValue<number>;
  progress: MotionValue<number>;
  velocity: MotionValue<number>;
  lenisRef: { current: Lenis | null };
}) {
  const lenis = useLenis((instance) => {
    scrollY.set(instance.scroll);
    progress.set(instance.progress);
    velocity.set(instance.velocity);
  });
  useEffect(() => {
    lenisRef.current = lenis ?? null;
    return () => {
      lenisRef.current = null;
    };
  }, [lenis, lenisRef]);
  return null;
}

/** Native scroll listener for the reduced-motion path and the no-provider fallback. */
function useNativeScrollSync(
  enabled: boolean,
  getTarget: () => ScrollSource | null,
  scrollY: MotionValue<number>,
  progress: MotionValue<number>,
  velocity: MotionValue<number>,
) {
  useEffect(() => {
    if (!enabled) return;
    const target = getTarget();
    if (!target) return;
    let lastY = readMetrics(target).y;
    let lastT = performance.now();
    const onScroll = () => {
      const { y, max } = readMetrics(target);
      const now = performance.now();
      const dt = now - lastT || 16;
      scrollY.set(y);
      progress.set(max > 0 ? y / max : 0);
      velocity.set(((y - lastY) / dt) * 16);
      lastY = y;
      lastT = now;
    };
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [enabled, getTarget, scrollY, progress, velocity]);
}

export function SmoothScroll({
  children,
  root = true,
  lerp = 0.1,
  duration = 1.2,
  orientation = "vertical",
  wheelMultiplier = 1,
  touch = false,
  className,
}: SmoothScrollProps) {
  const reduce = useReducedMotion();
  const scrollY = useMotionValue(0);
  const progress = useMotionValue(0);
  const velocity = useMotionValue(0);
  const lenisRef = useRef<Lenis | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nativeSource = useCallback(
    (): ScrollSource | null => (root ? window : containerRef.current),
    [root],
  );

  const scrollTo = useCallback(
    (target: ScrollTarget, options?: ScrollToOptions) => {
      const lenis = lenisRef.current;
      if (lenis && !reduce) {
        lenis.scrollTo(target, {
          offset: options?.offset,
          duration: options?.duration,
          immediate: options?.immediate,
        });
        return;
      }
      const source = nativeSource();
      const behavior = reduce || options?.immediate ? "auto" : "smooth";
      const top = resolveTop(target, source ?? window, options?.offset);
      (source ?? window).scrollTo({ top, behavior });
    },
    [reduce, nativeSource],
  );

  // Reduced motion drives the native listener; the Lenis path leaves it
  // disabled and lets LenisBridge feed the values instead.
  useNativeScrollSync(!!reduce, nativeSource, scrollY, progress, velocity);

  const api = useMemo<SmoothScrollApi>(
    () => ({ lenis: lenisRef.current, scrollY, progress, velocity, scrollTo }),
    [scrollY, progress, velocity, scrollTo],
  );

  if (reduce) {
    return (
      <SmoothScrollContext.Provider value={api}>
        <div ref={containerRef} className={className}>
          {children}
        </div>
      </SmoothScrollContext.Provider>
    );
  }

  return (
    <SmoothScrollContext.Provider value={api}>
      <ReactLenis
        root={root}
        className={className}
        options={{
          lerp,
          duration,
          orientation,
          wheelMultiplier,
          smoothWheel: true,
          syncTouch: touch,
          easing: EASE_SCROLL,
        }}
      >
        <LenisBridge
          scrollY={scrollY}
          progress={progress}
          velocity={velocity}
          lenisRef={lenisRef}
        />
        {children}
      </ReactLenis>
    </SmoothScrollContext.Provider>
  );
}

/**
 * Read the page's smooth-scroll state. Inside <SmoothScroll> it returns the
 * shared motion values; outside it falls back to a native window scroll
 * listener so scroll-driven components still work without the provider.
 */
export function useSmoothScroll(): SmoothScrollApi {
  const ctx = useContext(SmoothScrollContext);
  const scrollY = useMotionValue(0);
  const progress = useMotionValue(0);
  const velocity = useMotionValue(0);

  const windowSource = useCallback((): ScrollSource => window, []);
  useNativeScrollSync(ctx === null, windowSource, scrollY, progress, velocity);

  const scrollTo = useCallback((target: ScrollTarget, options?: ScrollToOptions) => {
    window.scrollTo({
      top: resolveTop(target, window, options?.offset),
      behavior: options?.immediate ? "auto" : "smooth",
    });
  }, []);

  const fallback = useMemo<SmoothScrollApi>(
    () => ({ lenis: null, scrollY, progress, velocity, scrollTo }),
    [scrollY, progress, velocity, scrollTo],
  );

  return ctx ?? fallback;
}

// Soft follow so the indicator trails the scroll smoothly instead of snapping;
// looser than the UI springs in lib/ease.ts on purpose.
const PROGRESS_SPRING = { stiffness: 120, damping: 30, mass: 0.6 };

type CommonProps = {
  /** Override the scroll source. Defaults to the page via useSmoothScroll. */
  progress?: MotionValue<number>;
  /** Spring-smooth the value. Disabled automatically under reduced motion. */
  spring?: boolean;
  className?: string;
};

export interface ScrollProgressBarProps extends CommonProps {
  variant?: "bar";
  position?: "top" | "bottom";
  /** Bar thickness in px. */
  height?: number;
  /** Position the bar with `fixed` (page) or `absolute` (embedded). */
  fixed?: boolean;
}

export interface ScrollProgressCircleProps extends CommonProps {
  variant: "circle";
  /** Diameter in px. */
  size?: number;
  /** Stroke width in px. */
  thickness?: number;
}

export type ScrollProgressProps =
  | ScrollProgressBarProps
  | ScrollProgressCircleProps;

function useProgressValue(source: MotionValue<number> | undefined, spring: boolean) {
  const reduce = useReducedMotion();
  const fallback = useSmoothScroll().progress;
  const raw = source ?? fallback;
  const smoothed = useSpring(raw, PROGRESS_SPRING);
  return spring && !reduce ? smoothed : raw;
}

export function ScrollProgress(props: ScrollProgressProps) {
  if (props.variant === "circle") return <ScrollProgressCircle {...props} />;
  return <ScrollProgressBar {...props} />;
}

function ScrollProgressBar({
  progress,
  spring = true,
  position = "top",
  height = 2,
  fixed = true,
  className,
}: ScrollProgressBarProps) {
  const value = useProgressValue(progress, spring);
  return (
    <motion.div
      aria-hidden
      style={{ height, scaleX: value }}
      className={cn(
        "left-0 right-0 z-50 origin-left bg-foreground",
        fixed ? "fixed" : "absolute",
        position === "top" ? "top-0" : "bottom-0",
        className,
      )}
    />
  );
}

function ScrollProgressCircle({
  progress,
  spring = true,
  size = 40,
  thickness = 3,
  className,
}: ScrollProgressCircleProps) {
  const value = useProgressValue(progress, spring);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useTransform(value, (v) => circumference * (1 - v));

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("text-foreground", className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={thickness}
        className="stroke-current opacity-15"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={thickness}
        strokeLinecap="round"
        className="stroke-current"
        strokeDasharray={circumference}
        style={{ strokeDashoffset: offset }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
