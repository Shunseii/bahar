/**
 * Flashcard review screen - dedicated route outside of drawer navigation.
 * This prevents drawer swipe gestures from interfering with card swiping.
 */

import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashcardReview } from "@/components/flashcards/FlashcardReview";
import type { FlashcardQueue } from "@/lib/db/operations/flashcards";

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    filters?: string;
    showReverse?: string;
    initialQueue?: string;
    regularCount?: string;
    backlogCount?: string;
  }>();

  const filters: SelectDeck["filters"] = params.filters
    ? JSON.parse(params.filters)
    : {};
  const showReverse = params.showReverse === "true";
  const initialQueue = (params.initialQueue ?? "regular") as FlashcardQueue;
  const queueCounts = {
    regular: Number(params.regularCount ?? 0),
    backlog: Number(params.backlogCount ?? 0),
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <FlashcardReview
        filters={filters}
        initialQueue={initialQueue}
        onClose={handleClose}
        queueCounts={queueCounts}
        showReverse={showReverse}
      />
    </View>
  );
}
