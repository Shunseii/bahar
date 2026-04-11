import { findHighlightPositions } from "@bahar/search/highlight";
import { type FC, memo, useMemo } from "react";
import { Text, type TextProps } from "react-native";
import { useThemeColors } from "@/lib/theme";

interface HighlightTextProps extends TextProps {
  text: string;
  searchTerm: string;
  highlightColor?: string;
}

export const HighlightText: FC<HighlightTextProps> = memo(
  ({ text, searchTerm, highlightColor, ...textProps }) => {
    const colors = useThemeColors();
    const bgColor = highlightColor ?? `${colors.primary}30`;

    const segments = useMemo(() => {
      if (!searchTerm.trim()) return null;

      const positions = findHighlightPositions(text, searchTerm);
      if (positions.length === 0) return null;

      const result: Array<{ text: string; highlighted: boolean }> = [];
      let lastEnd = 0;

      for (const { start, end } of positions) {
        if (start > lastEnd) {
          result.push({ text: text.slice(lastEnd, start), highlighted: false });
        }
        result.push({ text: text.slice(start, end), highlighted: true });
        lastEnd = end;
      }

      if (lastEnd < text.length) {
        result.push({ text: text.slice(lastEnd), highlighted: false });
      }

      return result;
    }, [text, searchTerm]);

    if (!segments) {
      return <Text {...textProps}>{text}</Text>;
    }

    return (
      <Text {...textProps}>
        {segments.map((segment, i) =>
          segment.highlighted ? (
            <Text
              key={i}
              style={{
                backgroundColor: bgColor,
                borderRadius: 2,
              }}
            >
              {segment.text}
            </Text>
          ) : (
            segment.text
          )
        )}
      </Text>
    );
  }
);
