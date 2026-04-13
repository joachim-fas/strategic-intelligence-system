"use client";

/**
 * VoltInputGroup -- Volt UI
 * Input with addon slots (icons, buttons, text) on inline-start/end positions.
 * Compound component: VoltInputGroup > VoltInputGroupAddon + VoltInputGroupInput
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Root ── */
export const VoltInputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="input-group"
    role="group"
    className={cn(
      "group/input-group border-input relative flex w-full items-center",
      "rounded-md border shadow-xs transition-[color,box-shadow] outline-none",
      "h-9 min-w-0",
      // Focus state
      "has-[[data-slot=input-group-control]:focus-visible]:border-ring",
      "has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
      "has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
      className
    )}
    {...props}
  />
));
VoltInputGroup.displayName = "VoltInputGroup";

/* ── Addon ── */
const inputGroupAddonVariants = cva(
  [
    "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2",
    "py-1.5 text-sm font-medium select-none",
    "[&>svg:not([class*='size-'])]:size-4",
    "group-data-[disabled=true]/input-group:opacity-50",
  ],
  {
    variants: {
      align: {
        "inline-start": "order-first pl-3",
        "inline-end": "order-last pr-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
);

export interface VoltInputGroupAddonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inputGroupAddonVariants> {}

export const VoltInputGroupAddon = React.forwardRef<
  HTMLDivElement,
  VoltInputGroupAddonProps
>(({ className, align = "inline-start", onClick, ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    data-slot="input-group-addon"
    data-align={align}
    className={cn(inputGroupAddonVariants({ align }), className)}
    onClick={(e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.parentElement?.querySelector("input")?.focus();
      onClick?.(e);
    }}
    {...props}
  />
));
VoltInputGroupAddon.displayName = "VoltInputGroupAddon";

/* ── Input ── */
export const VoltInputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "flex-1 rounded-none border-0 bg-transparent shadow-none outline-none",
      "px-3 py-1 text-sm text-foreground",
      "placeholder:text-muted-foreground",
      "focus-visible:ring-0",
      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
VoltInputGroupInput.displayName = "VoltInputGroupInput";

/* ── Text addon ── */
export const VoltInputGroupText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "text-muted-foreground flex items-center gap-2 text-sm",
      "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
));
VoltInputGroupText.displayName = "VoltInputGroupText";
