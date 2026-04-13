"use client";

/**
 * VoltPopover -- Volt UI
 * Floating popover panel triggered by click.
 * Pure implementation using React state and positioning.
 * API mirrors Radix Popover: VoltPopover, VoltPopoverTrigger, VoltPopoverContent.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";

/* ── Context ── */
interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const PopoverContext = createContext<PopoverContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
});

/* ── Root ── */
export interface VoltPopoverProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const VoltPopover: React.FC<VoltPopoverProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      <div data-slot="popover" className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

/* ── Trigger ── */
export interface VoltPopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const VoltPopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  VoltPopoverTriggerProps
>(({ onClick, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useContext(PopoverContext);

  return (
    <button
      ref={(node) => {
        (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }}
      data-slot="popover-trigger"
      type="button"
      aria-expanded={open}
      onClick={(e) => {
        setOpen(!open);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
VoltPopoverTrigger.displayName = "VoltPopoverTrigger";

/* ── Content ── */
export interface VoltPopoverContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  sideOffset?: number;
}

export const VoltPopoverContent = React.forwardRef<
  HTMLDivElement,
  VoltPopoverContentProps
>(
  (
    {
      className,
      align = "center",
      side = "bottom",
      sideOffset = 4,
      children,
      ...props
    },
    ref
  ) => {
    const { open, setOpen } = useContext(PopoverContext);
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          contentRef.current &&
          !contentRef.current.contains(target)
        ) {
          // Give trigger click a chance to toggle
          requestAnimationFrame(() => setOpen(false));
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open, setOpen]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen]);

    if (!open) return null;

    const alignClasses =
      align === "start"
        ? "left-0"
        : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

    const sideClasses =
      side === "top"
        ? "bottom-full mb-1"
        : "top-full mt-1";

    return (
      <div
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        data-slot="popover-content"
        className={cn(
          "absolute z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
          "bg-popover text-popover-foreground",
          "animate-volt-fade-in",
          sideClasses,
          alignClasses,
          className
        )}
        style={{ marginTop: side === "bottom" ? sideOffset : undefined, marginBottom: side === "top" ? sideOffset : undefined }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
VoltPopoverContent.displayName = "VoltPopoverContent";
