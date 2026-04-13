"use client";

/**
 * VoltAvatar -- Volt UI
 * Avatar component with image and fallback support.
 * Pure implementation -- no Radix dependency.
 */

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface VoltAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Fallback content (e.g. initials) shown when image is not available */
  fallback?: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses: Record<string, string> = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
  xl: "size-14 text-lg",
};

export const VoltAvatar = React.forwardRef<HTMLDivElement, VoltAvatarProps>(
  ({ className, src, alt, fallback, size = "md", children, ...props }, ref) => {
    const [imgError, setImgError] = useState(false);
    const showImage = src && !imgError;

    return (
      <div
        ref={ref}
        data-slot="avatar"
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {showImage ? (
          <img
            data-slot="avatar-image"
            src={src}
            alt={alt ?? ""}
            className="aspect-square size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            data-slot="avatar-fallback"
            className={cn(
              "bg-muted flex size-full items-center justify-center rounded-full",
              "font-medium text-muted-foreground"
            )}
          >
            {fallback ?? children}
          </div>
        )}
      </div>
    );
  }
);
VoltAvatar.displayName = "VoltAvatar";
