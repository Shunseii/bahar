import { cn } from "@bahar/design-system";
import { cva, VariantProps } from "class-variance-authority";
import { FC, PropsWithChildren } from "react";
import { Pressable, Text } from "react-native";

const buttonVariants = cva(
  "items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "",
        link: "text-primary",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends VariantProps<typeof buttonVariants>,
    PropsWithChildren {
  onPress: () => void;
  className?: string;
}

export const Button: FC<ButtonProps> = ({
  onPress,
  size,
  variant,
  className,
  children,
}) => {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size, className }))}
      onPress={onPress}
    >
      <Text className={cn(buttonVariants({ variant, size, className }))}>
        {children}
      </Text>
    </Pressable>
  );
};
