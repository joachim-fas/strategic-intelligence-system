"use client";

/**
 * VoltDialog -- Volt UI
 * Dialog/modal with overlay, close button, and animation.
 * Compound component pattern matching Radix Dialog API.
 * Uses Framer Motion for smooth open/close animations.
 *
 * Note: This coexists with VoltModal which is a simpler single-component modal.
 * VoltDialog provides the compound pattern (Dialog > Trigger > Content > Header/Footer).
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
interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
});

/* ── Root ── */
export interface VoltDialogProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const VoltDialog: React.FC<VoltDialogProps> = ({
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
    <DialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

/* ── Trigger ── */
export const VoltDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, children, ...props }, ref) => {
  const { setOpen } = useContext(DialogContext);

  return (
    <button
      ref={ref}
      data-slot="dialog-trigger"
      type="button"
      onClick={(e) => {
        setOpen(true);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
VoltDialogTrigger.displayName = "VoltDialogTrigger";

/* ── Close ── */
export const VoltDialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, children, ...props }, ref) => {
  const { setOpen } = useContext(DialogContext);

  return (
    <button
      ref={ref}
      data-slot="dialog-close"
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
VoltDialogClose.displayName = "VoltDialogClose";

/* ── Content ── */
export interface VoltDialogContentProps {
  className?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
}

export const VoltDialogContent = React.forwardRef<
  HTMLDivElement,
  VoltDialogContentProps
>(({ className, children, showCloseButton = true }, ref) => {
  const { open, setOpen } = useContext(DialogContext);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            data-slot="dialog-overlay"
          />

          {/* Dialog panel */}
          <motion.div
            ref={ref}
            data-slot="dialog-content"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "bg-background relative z-50 grid w-full max-w-[calc(100%-2rem)] gap-4",
              "rounded-lg border p-6 shadow-lg sm:max-w-lg",
              className
            )}
          >
            {children}
            {showCloseButton && (
              <button
                data-slot="dialog-close"
                className={cn(
                  "absolute top-4 right-4 rounded-xs opacity-70 transition-opacity",
                  "hover:opacity-100 focus:outline-hidden",
                  "ring-offset-background focus:ring-ring focus:ring-2 focus:ring-offset-2",
                  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                )}
                onClick={() => setOpen(false)}
              >
                <X />
                <span className="sr-only">Close</span>
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
VoltDialogContent.displayName = "VoltDialogContent";

/* ── Header ── */
export const VoltDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dialog-header"
    className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
    {...props}
  />
));
VoltDialogHeader.displayName = "VoltDialogHeader";

/* ── Footer ── */
export const VoltDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dialog-footer"
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
));
VoltDialogFooter.displayName = "VoltDialogFooter";

/* ── Title ── */
export const VoltDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg leading-none font-semibold", className)}
    {...props}
  />
));
VoltDialogTitle.displayName = "VoltDialogTitle";

/* ── Description ── */
export const VoltDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
VoltDialogDescription.displayName = "VoltDialogDescription";
