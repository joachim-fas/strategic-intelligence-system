"use client";

/**
 * VoltDropdownSelect -- Volt UI
 * Popup select dropdown (like Radix Select but pure implementation).
 * For cases where a native <select> is not sufficient.
 * API: VoltDropdownSelect > VoltDropdownSelectTrigger + VoltDropdownSelectContent > VoltDropdownSelectItem
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ── Context ── */
interface SelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  displayValue: string;
  setDisplayValue: (label: string) => void;
}

const SelectContext = createContext<SelectContextValue>({
  open: false,
  setOpen: () => {},
  value: "",
  onValueChange: () => {},
  displayValue: "",
  setDisplayValue: () => {},
});

/* ── Root ── */
export interface VoltDropdownSelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const VoltDropdownSelect: React.FC<VoltDropdownSelectProps> = ({
  children,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [internalOpen, setInternalOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const setOpen = useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );

  const handleValueChange = useCallback(
    (v: string) => {
      setInternalValue(v);
      onValueChange?.(v);
      setOpen(false);
    },
    [onValueChange, setOpen]
  );

  return (
    <SelectContext.Provider
      value={{
        open: isOpen,
        setOpen,
        value: currentValue,
        onValueChange: handleValueChange,
        displayValue,
        setDisplayValue,
      }}
    >
      <div data-slot="select" className="relative inline-block">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

/* ── Trigger ── */
export interface VoltDropdownSelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string;
  size?: "sm" | "default";
}

export const VoltDropdownSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownSelectTriggerProps
>(({ className, placeholder = "Select...", size = "default", children, ...props }, ref) => {
  const { open, setOpen, displayValue } = useContext(SelectContext);

  return (
    <button
      ref={ref}
      data-slot="select-trigger"
      data-size={size}
      type="button"
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => setOpen(!open)}
      className={cn(
        "border-input flex w-fit items-center justify-between gap-2",
        "rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap",
        "shadow-xs transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "default" ? "h-9" : "h-8",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className={cn("line-clamp-1", !displayValue && "text-muted-foreground")}>
        {displayValue || placeholder}
      </span>
      <ChevronDown className="size-4 opacity-50" />
    </button>
  );
});
VoltDropdownSelectTrigger.displayName = "VoltDropdownSelectTrigger";

/* ── Content ── */
export interface VoltDropdownSelectContentProps {
  className?: string;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
}

export const VoltDropdownSelectContent = React.forwardRef<
  HTMLDivElement,
  VoltDropdownSelectContentProps
>(({ className, align = "start", children }, ref) => {
  const { open, setOpen } = useContext(SelectContext);
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={(node) => {
            (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          data-slot="select-content"
          role="listbox"
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={cn(
            "absolute z-50 mt-1 top-full min-w-[8rem] w-full overflow-hidden",
            "rounded-md border p-1 shadow-md",
            "bg-popover text-popover-foreground",
            "max-h-60 overflow-y-auto",
            alignClasses,
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
VoltDropdownSelectContent.displayName = "VoltDropdownSelectContent";

/* ── Item ── */
export interface VoltDropdownSelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const VoltDropdownSelectItem = React.forwardRef<
  HTMLButtonElement,
  VoltDropdownSelectItemProps
>(({ className, children, value, ...props }, ref) => {
  const { value: selectedValue, onValueChange, setDisplayValue } =
    useContext(SelectContext);
  const isSelected = selectedValue === value;

  // Register display value when selected
  React.useEffect(() => {
    if (isSelected && typeof children === "string") {
      setDisplayValue(children);
    }
  }, [isSelected, children, setDisplayValue]);

  return (
    <button
      ref={ref}
      data-slot="select-item"
      role="option"
      aria-selected={isSelected}
      type="button"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2",
        "text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={() => {
        onValueChange(value);
        if (typeof children === "string") {
          setDisplayValue(children);
        }
      }}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        {isSelected && <Check className="size-4" />}
      </span>
      {children}
    </button>
  );
});
VoltDropdownSelectItem.displayName = "VoltDropdownSelectItem";

/* ── Label (group label inside content) ── */
export const VoltDropdownSelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="select-label"
    className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
    {...props}
  />
));
VoltDropdownSelectLabel.displayName = "VoltDropdownSelectLabel";

/* ── Separator ── */
export const VoltDropdownSelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="select-separator"
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
));
VoltDropdownSelectSeparator.displayName = "VoltDropdownSelectSeparator";
