import React from "react";
import { View, Text, ViewProps, TextProps } from "react-native";
import { cn } from "@bahar/design-system";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

interface CardDescriptionProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

const Card = ({ children, className, ...props }: CardProps) => {
  return (
    <View
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
};

const CardHeader = ({ children, className, ...props }: CardHeaderProps) => {
  return (
    <View className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
      {children}
    </View>
  );
};

const CardTitle = ({ children, className, ...props }: CardTitleProps) => {
  return (
    <Text
      className={cn(
        "text-2xl font-semibold text-foreground leading-none tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </Text>
  );
};

const CardDescription = ({
  children,
  className,
  ...props
}: CardDescriptionProps) => {
  return (
    <Text
      className={cn("ltr:text-sm rtl:text-lg text-muted-foreground", className)}
      {...props}
    >
      {children}
    </Text>
  );
};

const CardContent = ({ children, className, ...props }: CardContentProps) => {
  return (
    <View className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </View>
  );
};

export { Card, CardHeader, CardTitle, CardDescription, CardContent };

