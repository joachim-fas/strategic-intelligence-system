/**
 * VoltKbd -- Volt UI
 * Keyboard shortcut indicator / key cap.
 * Renders an inline styled <kbd> element.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface VoltKbdProps extends React.HTMLAttributes<HTMLElement> {}

export const VoltKbd = React.forwardRef<HTMLElement, VoltKbdProps>(
  ({ className, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        data-slot="kbd"
        className={cn(
          "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5",
          "items-center justify-center gap-1 rounded-sm px-1",
          "font-sans text-xs font-medium select-none",
          "[&_svg:not([class*='size-'])]:size-3",
          className
        )}
        {...props}
      />
    );
  }
);
VoltKbd.displayName = "VoltKbd";

export interface VoltKbdGroupProps extends React.HTMLAttributes<HTMLElement> {}

export const VoltKbdGroup = React.forwardRef<HTMLElement, VoltKbdGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        data-slot="kbd-group"
        className={cn("inline-flex items-center gap-1", className)}
        {...props}
      />
    );
  }
);
VoltKbdGroup.displayName = "VoltKbdGroup";
