"use client";

/**
 * VoltSeparator -- Volt UI
 * Visual separator line (horizontal or vertical).
 * Pure CSS implementation, no Radix dependency.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface VoltSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export const VoltSeparator = React.forwardRef<HTMLDivElement, VoltSeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="separator"
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
          className
        )}
        {...props}
      />
    );
  }
);
VoltSeparator.displayName = "VoltSeparator";
