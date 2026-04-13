"use client";

/**
 * VoltToggleGroup -- Volt UI
 * Group of toggle buttons where one or multiple can be active.
 * Pure implementation -- no Radix dependency.
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── Toggle button variants (shared with VoltToggle in VoltToggle.tsx) ── */
const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "outline-none transition-[color,box-shadow]",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-transparent",
          "hover:bg-muted hover:text-muted-foreground",
          "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        ],
        outline: [
          "border border-input bg-transparent shadow-xs",
          "hover:bg-accent hover:text-accent-foreground",
          "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        ],
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/* ── Context ── */
interface ToggleGroupContextValue {
  type: "single" | "multiple";
  value: Set<string>;
  toggle: (val: string) => void;
  variant: "default" | "outline";
  size: "default" | "sm" | "lg";
}

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  type: "single",
  value: new Set(),
  toggle: () => {},
  variant: "default",
  size: "default",
});

/* ── Root ── */
export interface VoltToggleGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue">,
    VariantProps<typeof toggleGroupItemVariants> {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

export const VoltToggleGroup = React.forwardRef<HTMLDivElement, VoltToggleGroupProps>(
  (
    {
      type = "single",
      value: controlledValue,
      defaultValue,
      onValueChange,
      variant = "default",
      size = "default",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const initialSet = new Set(
      Array.isArray(defaultValue)
        ? defaultValue
        : defaultValue
        ? [defaultValue]
        : []
    );
    const [internalValue, setInternalValue] = useState<Set<string>>(initialSet);

    const currentValue =
      controlledValue !== undefined
        ? new Set(
            Array.isArray(controlledValue) ? controlledValue : [controlledValue]
          )
        : internalValue;

    const toggle = useCallback(
      (val: string) => {
        let next: Set<string>;
        if (type === "single") {
          next = currentValue.has(val) ? new Set() : new Set([val]);
        } else {
          next = new Set(currentValue);
          if (next.has(val)) next.delete(val);
          else next.add(val);
        }
        setInternalValue(next);
        onValueChange?.(
          type === "single"
            ? Array.from(next)[0] ?? ""
            : Array.from(next)
        );
      },
      [type, currentValue, onValueChange]
    );

    return (
      <ToggleGroupContext.Provider
        value={{
          type,
          value: currentValue,
          toggle,
          variant: variant ?? "default",
          size: size ?? "default",
        }}
      >
        <div
          ref={ref}
          data-slot="toggle-group"
          data-variant={variant}
          data-size={size}
          role="group"
          className={cn(
            "group/toggle-group flex w-fit items-center rounded-md",
            variant === "outline" && "shadow-xs",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);
VoltToggleGroup.displayName = "VoltToggleGroup";

/* ── Item ── */
export interface VoltToggleGroupItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleGroupItemVariants> {
  value: string;
}

export const VoltToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  VoltToggleGroupItemProps
>(({ className, children, value, variant, size, ...props }, ref) => {
  const ctx = useContext(ToggleGroupContext);
  const isPressed = ctx.value.has(value);

  return (
    <button
      ref={ref}
      data-slot="toggle-group-item"
      data-state={isPressed ? "on" : "off"}
      data-variant={ctx.variant ?? variant}
      data-size={ctx.size ?? size}
      type="button"
      role="radio"
      aria-checked={isPressed}
      onClick={() => ctx.toggle(value)}
      className={cn(
        toggleGroupItemVariants({
          variant: ctx.variant ?? variant ?? "default",
          size: ctx.size ?? size ?? "default",
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none",
        "first:rounded-l-md last:rounded-r-md",
        "focus:z-10 focus-visible:z-10",
        ctx.variant === "outline" && "border-l-0 first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
VoltToggleGroupItem.displayName = "VoltToggleGroupItem";
