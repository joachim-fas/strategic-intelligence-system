"use client";

/**
 * VoltAccordion -- Volt UI
 * Collapsible accordion panels with smooth height animation.
 * Pure implementation -- no Radix dependency.
 * Supports single or multiple expanded items.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Context ── */
interface AccordionContextValue {
  type: "single" | "multiple";
  expandedItems: Set<string>;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue>({
  type: "single",
  expandedItems: new Set(),
  toggle: () => {},
});

/* ── Root ── */
export interface VoltAccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
}

export const VoltAccordion = React.forwardRef<HTMLDivElement, VoltAccordionProps>(
  (
    {
      type = "single",
      defaultValue,
      value: controlledValue,
      onValueChange,
      collapsible = true,
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
    const [internalExpanded, setInternalExpanded] = useState<Set<string>>(initialSet);

    const expanded = controlledValue !== undefined
      ? new Set(Array.isArray(controlledValue) ? controlledValue : [controlledValue])
      : internalExpanded;

    const toggle = useCallback(
      (itemValue: string) => {
        let next: Set<string>;
        if (type === "single") {
          if (expanded.has(itemValue) && collapsible) {
            next = new Set();
          } else {
            next = new Set([itemValue]);
          }
        } else {
          next = new Set(expanded);
          if (next.has(itemValue)) {
            next.delete(itemValue);
          } else {
            next.add(itemValue);
          }
        }
        setInternalExpanded(next);
        onValueChange?.(
          type === "single" ? Array.from(next)[0] ?? "" : Array.from(next)
        );
      },
      [type, expanded, collapsible, onValueChange]
    );

    return (
      <AccordionContext.Provider value={{ type, expandedItems: expanded, toggle }}>
        <div
          ref={ref}
          data-slot="accordion"
          className={className}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
VoltAccordion.displayName = "VoltAccordion";

/* ── Item ── */
export interface VoltAccordionItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItemContext = createContext<{ value: string; isOpen: boolean }>({
  value: "",
  isOpen: false,
});

export const VoltAccordionItem = React.forwardRef<
  HTMLDivElement,
  VoltAccordionItemProps
>(({ value, className, children, ...props }, ref) => {
  const { expandedItems } = useContext(AccordionContext);
  const isOpen = expandedItems.has(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        ref={ref}
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        className={cn("border-b last:border-b-0", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
});
VoltAccordionItem.displayName = "VoltAccordionItem";

/* ── Trigger ── */
export interface VoltAccordionTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const VoltAccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  VoltAccordionTriggerProps
>(({ className, children, ...props }, ref) => {
  const { toggle } = useContext(AccordionContext);
  const { value, isOpen } = useContext(AccordionItemContext);

  return (
    <h3 className="flex">
      <button
        ref={ref}
        data-slot="accordion-trigger"
        data-state={isOpen ? "open" : "closed"}
        type="button"
        aria-expanded={isOpen}
        onClick={() => toggle(value)}
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4",
          "text-left text-sm font-medium transition-all outline-none",
          "hover:underline",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5",
            "transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
    </h3>
  );
});
VoltAccordionTrigger.displayName = "VoltAccordionTrigger";

/* ── Content ── */
export interface VoltAccordionContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const VoltAccordionContent = React.forwardRef<
  HTMLDivElement,
  VoltAccordionContentProps
>(({ className, children, ...props }, ref) => {
  const { isOpen } = useContext(AccordionItemContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  return (
    <div
      data-slot="accordion-content"
      data-state={isOpen ? "open" : "closed"}
      className="overflow-hidden text-sm transition-[height] duration-200 ease-out"
      style={{ height: isOpen ? height : 0 }}
    >
      <div ref={contentRef} className={cn("pt-0 pb-4", className)} {...props}>
        {children}
      </div>
    </div>
  );
});
VoltAccordionContent.displayName = "VoltAccordionContent";
