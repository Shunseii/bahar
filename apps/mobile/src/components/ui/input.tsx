import * as React from "react";
import { TextInput, TextInputProps } from "react-native";

import { cn } from "@bahar/design-system";

// TODO: add disabled styles
// On native, "disabled:" is only available for components with a disabled prop.
// Unfortunately <TextInput> uses enabled={false} instead of disabled={true}, so it will not work with "disabled:".
// On Nativewind v4.
// https://www.nativewind.dev/core-concepts/states#form-states-
const Input = React.forwardRef<TextInput, TextInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextInput
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer text-foreground",
          "placeholder:text-muted-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
