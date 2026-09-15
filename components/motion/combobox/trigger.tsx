"use client";

import { ChevronsUpDown, Search } from "lucide-react";
import { motion } from "motion/react";
import type {
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { cn } from "@/lib/utils";
import { mergeRefs, useComboboxContext } from "./context";

const COMBOBOX_TRIGGER_MORPH = {
  type: "spring" as const,
  duration: 0.5,
  bounce: 0.22,
};

/** §3 warm-stone focus — never the browser amber/gold ring. */
const WARM_STONE_FOCUS =
  "outline-none focus-within:[outline:var(--v3-focus-ring,3px_solid_#b9ab97)] focus-within:[outline-offset:var(--v3-focus-offset,2px)]";

export interface ComboboxTriggerProps {
  children: ReactNode;
  className?: string;
}

export function ComboboxTrigger({ children, className }: ComboboxTriggerProps) {
  const context = useComboboxContext("ComboboxTrigger");

  return (
    <motion.div
      ref={context.triggerRef}
      id={context.triggerId}
      data-combobox-trigger=""
      data-state={context.open ? "open" : "closed"}
      initial={false}
      animate={{ width: "100%" }}
      transition={context.reduce ? { duration: 0 } : COMBOBOX_TRIGGER_MORPH}
      onPointerDown={(event) => {
        if (context.disabled || event.target === context.inputRef.current) return;
        event.preventDefault();
        context.inputRef.current?.focus({ preventScroll: true });
        context.setOpen(true);
      }}
      className={cn(
        "relative z-20 flex h-12 w-full min-w-52 cursor-text items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border bg-transparent px-3 text-sm text-foreground transition-[border-color] hover:border-(--color-border-strong)",
        WARM_STONE_FOCUS,
        context.disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <span className="min-w-0 flex-1 text-left">{children}</span>
      <span aria-hidden className="shrink-0 text-muted-foreground">
        <ChevronsUpDown className="size-4" />
      </span>
    </motion.div>
  );
}

export interface ComboboxValueProps {
  placeholder?: ReactNode;
  children?:
    | ReactNode
    | ((value: string | undefined, label: string | undefined) => ReactNode);
  className?: string;
}

export function ComboboxValue({
  placeholder = "Select an option",
  children,
  className,
}: ComboboxValueProps) {
  const context = useComboboxContext("ComboboxValue");
  const label = context.labelFor(context.value);
  const content =
    typeof children === "function"
      ? children(context.value, label)
      : children ?? label ?? placeholder;

  return (
    <span
      className={cn(
        "block truncate",
        context.value === undefined
          ? "text-muted-foreground"
          : "text-foreground",
        className,
      )}
    >
      {content}
    </span>
  );
}

export interface ComboboxInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "defaultValue" | "value"
  > {
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
}

export function ComboboxInput({
  ref,
  className,
  wrapperClassName,
  "aria-label": ariaLabel = "Search options",
  onChange,
  onClick,
  onFocus,
  onKeyDown,
  onPointerDown,
  placeholder = "Search…",
  ...props
}: ComboboxInputProps) {
  const context = useComboboxContext("ComboboxInput");
  const selectedLabel = context.labelFor(context.value);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // Opening is the whole action. While closed the list is still filtering
      // by the query the last session left, so a step taken here would be
      // measured against rows the next render replaces — and stamped with a
      // query it no longer has, which discards it. Open onto the selection,
      // and let the next key step through the list the user can see.
      if (!context.open) {
        context.setOpen(true);
        return;
      }
      context.moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" && context.open) {
      event.preventDefault();
      context.moveActive("first");
    } else if (event.key === "End" && context.open) {
      event.preventDefault();
      context.moveActive("last");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (context.open) context.selectActive();
      else context.setOpen(true);
    } else if (event.key === "Escape" && context.open) {
      event.preventDefault();
      context.setOpen(false, true);
    }
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        wrapperClassName,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <input
        {...props}
        ref={mergeRefs(ref, context.inputRef)}
        id={context.inputId}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={context.open}
        aria-controls={context.listId}
        aria-activedescendant={
          context.open ? context.activeItemId : undefined
        }
        autoComplete="off"
        disabled={context.disabled}
        value={context.open ? context.query : (selectedLabel ?? "")}
        placeholder={placeholder}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (event.defaultPrevented || context.open) return;
          event.preventDefault();
          context.inputRef.current?.focus({ preventScroll: true });
          context.setOpen(true);
        }}
        onFocus={(event) => {
          context.setOpen(true);
          onFocus?.(event);
        }}
        onClick={(event) => {
          context.setOpen(true);
          onClick?.(event);
        }}
        onChange={(event) => {
          context.setOpen(true);
          context.setQuery(event.target.value);
          onChange?.(event);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none [appearance:none] [box-shadow:none] placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed",
          className,
        )}
      />
    </div>
  );
}
