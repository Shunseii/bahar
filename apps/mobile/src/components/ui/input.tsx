import { cn } from "@bahar/design-system";
import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";

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
          "flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm",
          "placeholder:text-muted-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
