"use client";

import { cn } from "@bahar/design-system";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

/**
 * iOS-style segmented control: a muted track with a solid, elevated pill on the
 * active segment, so the selected option reads clearly at a glance. Built on
 * radix ToggleGroup (use `type="single"`) so keyboard/roving-tabindex a11y comes
 * for free. Distinct from ToggleGroup, which renders a bordered toggle
 * button-group rather than a segmented control.
 */
const SegmentedControl = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    className={cn(
      "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5",
      className
    )}
    ref={ref}
    {...props}
  />
));
SegmentedControl.displayName = "SegmentedControl";

const SegmentedControlItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    className={cn(
      "inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
SegmentedControlItem.displayName = "SegmentedControlItem";

export { SegmentedControl, SegmentedControlItem };
