"use client";

/**
 * VoltDropdownMenu -- Volt UI
 * Dropdown menu triggered by button click.
 * Pure implementation with React state and positioning.
 * API mirrors Radix DropdownMenu compound component pattern.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ── Context ── */
interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
});

/* ── Root ── */
export interface VoltDropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const VoltDropdownMenu: React.FC<VoltDropdownMenuProps> = ({
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
    <DropdownContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="dropdown-menu" className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

/* ── Trigger ── */
export interface VoltDropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const VoltDropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownMenuTriggerProps
>(({ onClick, children, asChild, ...props }, ref) => {
  const { open, setOpen } = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(!open);
    onClick?.(e);
  };

  // asChild: merge trigger props into the single child element
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref,
      "data-slot": "dropdown-menu-trigger",
      "aria-expanded": open,
      "aria-haspopup": "menu",
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
      data-slot="dropdown-menu-trigger"
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
VoltDropdownMenuTrigger.displayName = "VoltDropdownMenuTrigger";

/* ── Content ── */
export interface VoltDropdownMenuContentProps {
  className?: string;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  sideOffset?: number;
}

export const VoltDropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  VoltDropdownMenuContentProps
>(
  (
    {
      className,
      align = "start",
      side = "bottom",
      sideOffset = 4,
      children,
    },
    ref
  ) => {
    const { open, setOpen } = useContext(DropdownContext);
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        const wrapper = contentRef.current?.parentElement;
        if (wrapper && !wrapper.contains(target)) {
          setOpen(false);
        }
      };
      // Delay to avoid catching the same click that opened it
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handler);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handler);
      };
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

    const alignClasses =
      align === "start"
        ? "left-0"
        : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

    const sideClasses = side === "top" ? "bottom-full mb-1" : "top-full mt-1";

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={(node) => {
              (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            data-slot="dropdown-menu-content"
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md",
              "bg-popover text-popover-foreground",
              sideClasses,
              alignClasses,
              className
            )}
            style={{
              marginTop: side === "bottom" ? sideOffset : undefined,
              marginBottom: side === "top" ? sideOffset : undefined,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
VoltDropdownMenuContent.displayName = "VoltDropdownMenuContent";

/* ── Item ── */
export interface VoltDropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

export const VoltDropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownMenuItemProps
>(({ className, inset, variant = "default", onClick, children, ...props }, ref) => {
  const { setOpen } = useContext(DropdownContext);

  return (
    <button
      ref={ref}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      role="menuitem"
      type="button"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5",
        "text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "destructive" && "text-destructive focus:bg-destructive/10 focus:text-destructive",
        inset && "pl-8",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
VoltDropdownMenuItem.displayName = "VoltDropdownMenuItem";

/* ── Label ── */
export interface VoltDropdownMenuLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export const VoltDropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  VoltDropdownMenuLabelProps
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dropdown-menu-label"
    className={cn(
      "px-2 py-1.5 text-sm font-medium",
      inset && "pl-8",
      className
    )}
    {...props}
  />
));
VoltDropdownMenuLabel.displayName = "VoltDropdownMenuLabel";

/* ── Separator ── */
export const VoltDropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dropdown-menu-separator"
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
));
VoltDropdownMenuSeparator.displayName = "VoltDropdownMenuSeparator";

/* ── Shortcut ── */
export const VoltDropdownMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="dropdown-menu-shortcut"
    className={cn(
      "text-muted-foreground ml-auto text-xs tracking-widest",
      className
    )}
    {...props}
  />
));
VoltDropdownMenuShortcut.displayName = "VoltDropdownMenuShortcut";

/* ── Group ── */
export const VoltDropdownMenuGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => (
  <div ref={ref} data-slot="dropdown-menu-group" role="group" {...props} />
));
VoltDropdownMenuGroup.displayName = "VoltDropdownMenuGroup";

/* ── CheckboxItem ── */
export interface VoltDropdownMenuCheckboxItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const VoltDropdownMenuCheckboxItem = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownMenuCheckboxItemProps
>(({ className, children, checked, onCheckedChange, onClick, ...props }, ref) => {
  const { setOpen } = useContext(DropdownContext);

  return (
    <button
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      type="button"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8",
        "text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={(e) => {
        onCheckedChange?.(!checked);
        onClick?.(e);
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-4" />}
      </span>
      {children}
    </button>
  );
});
VoltDropdownMenuCheckboxItem.displayName = "VoltDropdownMenuCheckboxItem";

/* ── RadioGroup ── */
interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue>({
  value: "",
  onValueChange: () => {},
});

export interface VoltDropdownMenuRadioGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export const VoltDropdownMenuRadioGroup = React.forwardRef<
  HTMLDivElement,
  VoltDropdownMenuRadioGroupProps
>(({ value, onValueChange, ...props }, ref) => (
  <RadioGroupContext.Provider value={{ value, onValueChange }}>
    <div ref={ref} data-slot="dropdown-menu-radio-group" role="group" {...props} />
  </RadioGroupContext.Provider>
));
VoltDropdownMenuRadioGroup.displayName = "VoltDropdownMenuRadioGroup";

/* ── RadioItem ── */
export interface VoltDropdownMenuRadioItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const VoltDropdownMenuRadioItem = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownMenuRadioItemProps
>(({ className, children, value, onClick, ...props }, ref) => {
  const { value: groupValue, onValueChange } = useContext(RadioGroupContext);
  const checked = groupValue === value;

  return (
    <button
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      role="menuitemradio"
      aria-checked={checked}
      type="button"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8",
        "text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={(e) => {
        onValueChange(value);
        onClick?.(e);
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Circle className="size-2 fill-current" />}
      </span>
      {children}
    </button>
  );
});
VoltDropdownMenuRadioItem.displayName = "VoltDropdownMenuRadioItem";
