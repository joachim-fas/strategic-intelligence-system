/**
 * VoltSkeleton -- Volt UI
 * Placeholder skeleton for loading states with pulse animation.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface VoltSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const VoltSkeleton = React.forwardRef<HTMLDivElement, VoltSkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="skeleton"
        className={cn("bg-accent animate-pulse rounded-md", className)}
        {...props}
      />
    );
  }
);
VoltSkeleton.displayName = "VoltSkeleton";
