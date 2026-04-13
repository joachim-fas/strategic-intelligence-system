"use client";

/**
 * VoltScrollArea -- Volt UI
 * Custom scroll area with styled scrollbar.
 * Pure CSS/HTML implementation -- no Radix dependency.
 * Uses thin overlay scrollbars styled via CSS.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface VoltScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientation for the scroll direction */
  orientation?: "vertical" | "horizontal" | "both";
}

export const VoltScrollArea = React.forwardRef<HTMLDivElement, VoltScrollAreaProps>(
  ({ className, children, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="scroll-area"
        className={cn(
          "relative",
          orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
          orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
          orientation === "both" && "overflow-auto",
          // Thin scrollbar styling
          "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
          "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30",
          className
        )}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
VoltScrollArea.displayName = "VoltScrollArea";
