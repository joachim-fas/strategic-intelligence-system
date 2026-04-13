/**
 * VoltLabel -- Volt UI
 * Accessible label element for form controls.
 * Pure implementation, no Radix dependency.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface VoltLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const VoltLabel = React.forwardRef<HTMLLabelElement, VoltLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        data-slot="label"
        className={cn(
          "flex items-center gap-2 text-sm leading-none font-medium select-none",
          "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
VoltLabel.displayName = "VoltLabel";
