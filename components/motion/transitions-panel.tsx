"use client";
// transitions.dev panel-reveal — answer panel slides in after the address.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./transitions-panel.css";

/** Catalog surface class. Keep this token so ci:catalog-install can prove the recipe. */
export const TRANSITIONS_PANEL_SURFACE = "t-panel-slide";

type Props = {
  open: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function TransitionsPanel({ open, children, className, id }: Props) {
  return (
    <div
      id={id}
      className={cn(TRANSITIONS_PANEL_SURFACE, className)}
      data-open={open ? "true" : "false"}
    >
      {children}
    </div>
  );
}
