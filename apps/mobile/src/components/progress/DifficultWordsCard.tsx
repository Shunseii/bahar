import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useSetAtom } from "jotai";
import { ArrowLeftRight, ArrowRight, PencilLine } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { InfoTooltip } from "@/components/progress/InfoTooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { sortOptionAtom } from "@/lib/store/filters";
import { useThemeColors } from "@/lib/theme";

interface DifficultWordsCardProps {
  data:
    | {
        total: number;
        words: {
          word: string;
          translation: string;
          entryId: string;
          bothDirections: boolean;
        }[];
      }
    | undefined;
  isLoading: boolean;
}

export const DifficultWordsCard: FC<DifficultWordsCardProps> = ({
  data,
  isLoading,
}) => {
  const colors = useThemeColors();
  const router = useRouter();
  const setSortOption = useSetAtom(sortOptionAtom);
  const { formatNumber } = useFormatNumber();

  if (isLoading) {
    return (
      <Card className="gap-4 p-5">
        <Skeleton className="h-4 w-28" />
        <View className="gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </View>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const words = data?.words ?? [];

  return (
    <Card className="gap-4 p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-medium text-muted-foreground text-sm">
            <Trans>Difficult Words</Trans>
          </Text>
          <InfoTooltip>
            <Trans>
              Words you find hardest based on your review history. As you
              improve, words will naturally drop off this list.
            </Trans>
          </InfoTooltip>
        </View>
        {total > 0 && (
          <View className="rounded-full bg-muted px-2.5 py-0.5">
            <Text className="text-muted-foreground text-xs">
              {formatNumber(total)} <Trans>total</Trans>
            </Text>
          </View>
        )}
      </View>

      {words.length === 0 ? (
        <Text className="text-muted-foreground text-sm">
          <Trans>No difficult words yet.</Trans>
        </Text>
      ) : (
        <>
          <Text className="text-muted-foreground/60 text-xs">
            <Trans>Top 3 most difficult</Trans>
          </Text>

          <View className="gap-1.5">
            {words.map((w) => (
              <Pressable
                className="flex-row items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2.5 dark:bg-red-950/30"
                key={w.entryId}
                onPress={() =>
                  router.navigate(`/(search)/(home)/edit-word/${w.entryId}`)
                }
              >
                <View className="min-w-0 flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    {w.bothDirections && (
                      <ArrowLeftRight
                        color={colors.mutedForeground}
                        size={12}
                      />
                    )}
                    <Text
                      className="font-semibold text-foreground text-sm"
                      style={{ writingDirection: "rtl", textAlign: "left" }}
                    >
                      {w.word}
                    </Text>
                  </View>
                  <Text
                    className="text-muted-foreground text-xs"
                    style={{ writingDirection: "ltr" }}
                  >
                    {w.translation}
                  </Text>
                </View>

                <PencilLine color={colors.mutedForeground} size={14} />
              </Pressable>
            ))}
          </View>

          <Pressable
            className="flex-row items-center justify-center gap-1 pt-1"
            onPress={() => {
              setSortOption("difficulty");
              router.navigate("/(search)/(home)");
            }}
          >
            <Text className="font-medium text-primary text-sm">
              <Trans>View all in dictionary</Trans>
            </Text>
            <ArrowRight color={colors.primary} size={14} />
          </Pressable>
        </>
      )}
    </Card>
  );
};
