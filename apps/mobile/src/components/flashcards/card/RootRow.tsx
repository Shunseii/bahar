import type { RootLetters } from "@bahar/drizzle-user-db-schemas";
import type React from "react";
import { Fragment } from "react";
import { Text, View } from "react-native";

interface RootRowProps {
  root: RootLetters | null | undefined;
}

export const RootRow: React.FC<RootRowProps> = ({ root }) => {
  if (!root || root.length === 0) return null;

  return (
    <View
      className="flex-row items-center gap-1.5"
      style={{ direction: "rtl" }}
    >
      {root.map((letter, idx) => (
        <Fragment key={`${letter}-${idx}`}>
          {idx > 0 && <Text className="text-muted-foreground/60">·</Text>}
          <Text className="font-medium text-foreground">{letter}</Text>
        </Fragment>
      ))}
    </View>
  );
};

export default RootRow;
