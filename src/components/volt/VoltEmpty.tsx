/**
 * VoltEmpty -- Volt UI
 * Empty state component for when there is no data to display.
 * Supports icon, title, description, and action content slots.
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface VoltEmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const VoltEmpty = React.forwardRef<HTMLDivElement, VoltEmptyProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty"
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-6",
          "rounded-lg border-dashed p-6 text-center text-balance md:p-12",
          className
        )}
        {...props}
      />
    );
  }
);
VoltEmpty.displayName = "VoltEmpty";

export const VoltEmptyHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty-header"
    className={cn(
      "flex max-w-sm flex-col items-center gap-2 text-center",
      className
    )}
    {...props}
  />
));
VoltEmptyHeader.displayName = "VoltEmptyHeader";

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface VoltEmptyMediaProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyMediaVariants> {}

export const VoltEmptyMedia = React.forwardRef<HTMLDivElement, VoltEmptyMediaProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-icon"
        data-variant={variant}
        className={cn(emptyMediaVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
VoltEmptyMedia.displayName = "VoltEmptyMedia";

export const VoltEmptyTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty-title"
    className={cn("text-lg font-medium tracking-tight", className)}
    {...props}
  />
));
VoltEmptyTitle.displayName = "VoltEmptyTitle";

export const VoltEmptyDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty-description"
    className={cn(
      "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed",
      "[&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    {...props}
  />
));
VoltEmptyDescription.displayName = "VoltEmptyDescription";

export const VoltEmptyContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty-content"
    className={cn(
      "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
      className
    )}
    {...props}
  />
));
VoltEmptyContent.displayName = "VoltEmptyContent";
