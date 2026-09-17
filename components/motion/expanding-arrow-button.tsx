"use client";
// beui.dev/components/motion/expanding-arrow-button

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import {
  forwardRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";
import { cn } from "@/lib/utils";

export interface ExpandingArrowButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children"
> {
  children: ReactNode;
  accentClassName?: string;
  labelClassName?: string;
  /** Force the expanded trail (open-state shots / tests). */
  active?: boolean;
}

const ARROW_OPACITY = [1, 0.78, 0.54, 0.32, 0.16] as const;

function DottedChevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="3" cy="3" r="2.4" fill="currentColor" />
      <circle cx="10" cy="8.5" r="2.4" fill="currentColor" />
      <circle cx="17" cy="14" r="2.4" fill="currentColor" />
      <circle cx="10" cy="19.5" r="2.4" fill="currentColor" />
      <circle cx="3" cy="25" r="2.4" fill="currentColor" />
    </svg>
  );
}

export const ExpandingArrowButton = forwardRef<
  HTMLButtonElement,
  ExpandingArrowButtonProps
>(function ExpandingArrowButton(
  {
    children,
    className,
    accentClassName,
    labelClassName,
    disabled,
    active: activeProp,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active =
    activeProp === true ||
    (!disabled && ((canHover && hovered) || focused));
  const layoutTransition = reduce ? { duration: 0 } : SPRING_LAYOUT;

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(true);
    onMouseEnter?.(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(false);
    onMouseLeave?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      data-state={active ? "open" : "idle"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
      className={cn(
        "relative inline-flex h-16 min-w-72 items-center overflow-hidden rounded-[22px] bg-primary p-1.5 text-primary-foreground select-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <motion.span
        layout="size"
        aria-hidden="true"
        transition={layoutTransition}
        style={{
          width: active ? "calc(100% - 12px)" : 52,
          borderRadius: 16,
        }}
        className={cn(
          "absolute inset-y-1.5 left-1.5 z-10 overflow-hidden bg-primary-foreground text-primary",
          accentClassName,
        )}
      >
        <motion.span
          animate={{ opacity: active ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : 0.1, ease: EASE_OUT }}
          className="absolute inset-0 grid place-items-center"
        >
          <DottedChevron className="h-10 w-7" />
        </motion.span>

        <span className="absolute inset-0 flex items-center justify-start gap-1 px-4">
          {ARROW_OPACITY.map((opacity, index) => (
            <motion.span
              key={opacity}
              animate={{
                opacity: active ? 1 : 0,
                transform:
                  active && !reduce ? "translateX(0px)" : "translateX(-6px)",
              }}
              transition={{
                duration: reduce ? 0 : 0.18,
                delay: active && !reduce ? 0.04 + index * 0.025 : 0,
                ease: EASE_OUT,
              }}
              style={{ color: `color-mix(in oklab, currentColor ${Math.round(opacity * 100)}%, transparent)` }}
              className="inline-grid shrink-0 place-items-center"
            >
              <DottedChevron className="h-10 w-7" />
            </motion.span>
          ))}
        </span>
      </motion.span>

      <motion.span
        animate={{
          opacity: active ? 0 : 1,
          transform:
            active && !reduce ? "translateX(6px)" : "translateX(0px)",
        }}
        transition={{ duration: reduce ? 0 : 0.12, ease: EASE_OUT }}
        className={cn(
          "relative z-0 ml-[76px] mr-5 whitespace-nowrap text-lg font-medium tracking-[-0.02em]",
          labelClassName,
        )}
      >
        {children}
      </motion.span>
    </motion.button>
  );
});
