"use client";

/**
 * VoltSheet -- Volt UI
 * Side sheet / drawer panel that slides in from screen edges.
 * Pure implementation using React state, Framer Motion for animations.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Context ── */
interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextValue>({
  open: false,
  setOpen: () => {},
});

/* ── Root ── */
export interface VoltSheetProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const VoltSheet: React.FC<VoltSheetProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
};

/* ── Trigger ── */
export interface VoltSheetTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const VoltSheetTrigger = React.forwardRef<
  HTMLButtonElement,
  VoltSheetTriggerProps
>(({ onClick, children, asChild, ...props }, ref) => {
  const { setOpen } = useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(true);
    onClick?.(e);
  };

  // asChild: merge trigger props into the single child element
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref,
      "data-slot": "sheet-trigger",
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        handleClick(e);
        const childOnClick = (children as React.ReactElement<Record<string, unknown>>).props?.onClick;
        if (typeof childOnClick === "function") childOnClick(e);
      },
    });
  }

  return (
    <button
      ref={ref}
      data-slot="sheet-trigger"
      type="button"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
VoltSheetTrigger.displayName = "VoltSheetTrigger";

/* ── Close ── */
export interface VoltSheetCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const VoltSheetClose = React.forwardRef<
  HTMLButtonElement,
  VoltSheetCloseProps
>(({ onClick, children, ...props }, ref) => {
  const { setOpen } = useContext(SheetContext);
  return (
    <button
      ref={ref}
      data-slot="sheet-close"
      type="button"
      onClick={(e) => {
        setOpen(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
VoltSheetClose.displayName = "VoltSheetClose";

/* ── Slide animation config per side ── */
const slideVariants = {
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    className: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
  },
  left: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
    className: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  },
  top: {
    initial: { y: "-100%" },
    animate: { y: 0 },
    exit: { y: "-100%" },
    className: "inset-x-0 top-0 h-auto border-b",
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
    className: "inset-x-0 bottom-0 h-auto border-t",
  },
};

/* ── Content ── */
export interface VoltSheetContentProps {
  className?: string;
  children?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export const VoltSheetContent = React.forwardRef<
  HTMLDivElement,
  VoltSheetContentProps
>(({ className, children, side = "right" }, ref) => {
  const { open, setOpen } = useContext(SheetContext);
  const sv = slideVariants[side];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  // Lock scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            data-slot="sheet-overlay"
          />

          {/* Panel */}
          <motion.div
            ref={ref}
            data-slot="sheet-content"
            initial={sv.initial}
            animate={sv.animate}
            exit={sv.exit}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "bg-background fixed z-50 flex flex-col gap-4 shadow-lg",
              sv.className,
              className
            )}
          >
            {children}
            <button
              className={cn(
                "absolute top-4 right-4 rounded-xs opacity-70 transition-opacity",
                "hover:opacity-100 focus:outline-hidden",
                "ring-offset-background focus:ring-ring focus:ring-2 focus:ring-offset-2"
              )}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
VoltSheetContent.displayName = "VoltSheetContent";

/* ── Header ── */
export const VoltSheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sheet-header"
    className={cn("flex flex-col gap-1.5 p-4", className)}
    {...props}
  />
));
VoltSheetHeader.displayName = "VoltSheetHeader";

/* ── Footer ── */
export const VoltSheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sheet-footer"
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
));
VoltSheetFooter.displayName = "VoltSheetFooter";

/* ── Title ── */
export const VoltSheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="sheet-title"
    className={cn("text-foreground font-semibold", className)}
    {...props}
  />
));
VoltSheetTitle.displayName = "VoltSheetTitle";

/* ── Description ── */
export const VoltSheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="sheet-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
VoltSheetDescription.displayName = "VoltSheetDescription";
