/**
 * VoltField -- Volt UI
 * Form field layout components for consistent form structure.
 * Includes FieldSet, Field, FieldLabel, FieldDescription, FieldError.
 */

import React, { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ── FieldSet ── */
export const VoltFieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    data-slot="field-set"
    className={cn("flex flex-col gap-6", className)}
    {...props}
  />
));
VoltFieldSet.displayName = "VoltFieldSet";

/* ── FieldLegend ── */
export interface VoltFieldLegendProps
  extends React.HTMLAttributes<HTMLLegendElement> {
  variant?: "legend" | "label";
}

export const VoltFieldLegend = React.forwardRef<
  HTMLLegendElement,
  VoltFieldLegendProps
>(({ className, variant = "legend", ...props }, ref) => (
  <legend
    ref={ref}
    data-slot="field-legend"
    data-variant={variant}
    className={cn(
      "mb-3 font-medium",
      variant === "legend" ? "text-base" : "text-sm",
      className
    )}
    {...props}
  />
));
VoltFieldLegend.displayName = "VoltFieldLegend";

/* ── FieldGroup ── */
export const VoltFieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn(
      "flex w-full flex-col gap-7",
      className
    )}
    {...props}
  />
));
VoltFieldGroup.displayName = "VoltFieldGroup";

/* ── Field ── */
const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col [&>*]:w-full",
        horizontal: "flex-row items-center",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

export interface VoltFieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fieldVariants> {}

export const VoltField = React.forwardRef<HTMLDivElement, VoltFieldProps>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
);
VoltField.displayName = "VoltField";

/* ── FieldContent ── */
export const VoltFieldContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-content"
    className={cn(
      "flex flex-1 flex-col gap-1.5 leading-snug",
      className
    )}
    {...props}
  />
));
VoltFieldContent.displayName = "VoltFieldContent";

/* ── FieldLabel ── */
export const VoltFieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    data-slot="field-label"
    className={cn(
      "flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none",
      "group-data-[disabled=true]/field:opacity-50",
      className
    )}
    {...props}
  />
));
VoltFieldLabel.displayName = "VoltFieldLabel";

/* ── FieldDescription ── */
export const VoltFieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn(
      "text-muted-foreground text-sm leading-normal font-normal",
      "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    {...props}
  />
));
VoltFieldDescription.displayName = "VoltFieldDescription";

/* ── FieldError ── */
export interface VoltFieldErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  errors?: Array<{ message?: string } | undefined>;
}

export const VoltFieldError = React.forwardRef<HTMLDivElement, VoltFieldErrorProps>(
  ({ className, children, errors, ...props }, ref) => {
    const content = useMemo(() => {
      if (children) return children;
      if (!errors) return null;
      if (errors.length === 1 && errors[0]?.message) return errors[0].message;
      return (
        <ul className="ml-4 flex list-disc flex-col gap-1">
          {errors.map(
            (error, index) =>
              error?.message && <li key={index}>{error.message}</li>
          )}
        </ul>
      );
    }, [children, errors]);

    if (!content) return null;

    return (
      <div
        ref={ref}
        role="alert"
        data-slot="field-error"
        className={cn("text-destructive text-sm font-normal", className)}
        {...props}
      >
        {content}
      </div>
    );
  }
);
VoltFieldError.displayName = "VoltFieldError";
