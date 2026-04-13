/**
 * VoltSpinner -- Volt UI
 * Loading spinner using Lucide Loader2 icon with spin animation.
 */

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoltSpinnerProps extends React.SVGAttributes<SVGSVGElement> {}

export const VoltSpinner = React.forwardRef<SVGSVGElement, VoltSpinnerProps>(
  ({ className, ...props }, ref) => {
    return (
      <Loader2
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn("size-4 animate-spin", className)}
        {...props}
      />
    );
  }
);
VoltSpinner.displayName = "VoltSpinner";
