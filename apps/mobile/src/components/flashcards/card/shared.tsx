import type React from "react";
import { Text, View } from "react-native";

interface SectionHeaderProps {
  label: string;
  arabicLabel?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  arabicLabel,
}) => (
  <View className="flex-row items-center gap-1.5">
    <Text
      className="font-semibold text-[11px] text-muted-foreground"
      style={{ letterSpacing: 0.6 }}
    >
      {label}
    </Text>
    {arabicLabel && (
      <Text
        className="text-[11px] text-muted-foreground"
        style={{ writingDirection: "rtl" }}
      >
        {arabicLabel}
      </Text>
    )}
  </View>
);

interface FieldRowProps {
  label: string;
  arabicLabel?: string;
  children: React.ReactNode;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  label,
  arabicLabel,
  children,
}) => (
  <View className="flex-row items-center justify-between">
    <View className="flex-row items-center gap-1.5">
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      {arabicLabel && (
        <Text
          className="text-[11px] text-muted-foreground/70"
          style={{ writingDirection: "rtl" }}
        >
          {arabicLabel}
        </Text>
      )}
    </View>
    <View className="flex-row items-center gap-2">{children}</View>
  </View>
);

interface PillProps {
  children: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({ children }) => (
  <View className="rounded-full bg-muted px-2.5 py-0.5">
    <Text className="font-medium text-[12px] text-foreground">{children}</Text>
  </View>
);

export const Divider: React.FC = () => (
  <View className="h-px w-full bg-border/60" />
);

interface ArabicValueProps {
  children: React.ReactNode;
  primary?: boolean;
}

export const ArabicValue: React.FC<ArabicValueProps> = ({
  children,
  primary = true,
}) => (
  <Text
    className={
      primary
        ? "font-medium text-[18px] text-foreground"
        : "text-[16px] text-muted-foreground"
    }
    style={{ writingDirection: "rtl" }}
  >
    {children}
  </Text>
);
