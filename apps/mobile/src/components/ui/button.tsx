import { cn } from "@bahar/design-system";
import { cva, type VariantProps } from "class-variance-authority";
import type { ElementType, FC } from "react";
import {
  Pressable,
  type PressableProps,
  Text,
  useColorScheme,
  View,
} from "react-native";

const buttonVariants = cva(
  "flex flex-row items-center justify-center gap-x-2 rounded-md transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-input bg-background",
        secondary: "bg-secondary",
        ghost: "",
        link: "",
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
  }
);

const textVariants = cva("font-medium text-sm", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface IconElementProps {
  size?: number;
  color?: string;
}

interface ButtonProps
  extends VariantProps<typeof buttonVariants>,
    PressableProps {
  className?: string;
  Icon?: ElementType<IconElementProps>;
}

export const Button: FC<ButtonProps> = ({
  onPress,
  size,
  variant = "default",
  className,
  children,
  Icon,
  ...rest
}) => {
  const colorScheme = useColorScheme();
  const variantsWithFeedback = [
    "default",
    "destructive",
    "secondary",
    "outline",
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed && variantsWithFeedback.includes(variant!) ? 0.7 : 1,
      })}
      {...rest}
    >
      <View className={cn(buttonVariants({ variant, size, className }))}>
        {Icon && (
          <Icon color={colorScheme === "dark" ? "white" : "black"} size={16} />
        )}

        <Text
          className={cn(textVariants({ variant, className }), "text-center")}
        >
          {typeof children === "function"
            ? children({ pressed: false, hovered: false })
            : children}
        </Text>
      </View>
    </Pressable>
  );
};
