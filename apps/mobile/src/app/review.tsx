/**
 * Flashcard review screen - dedicated route outside of drawer navigation.
 * This prevents drawer swipe gestures from interfering with card swiping.
 */

import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashcardReview } from "@/components/flashcards/FlashcardReview";

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    filters?: string;
    showReverse?: string;
  }>();

  const filters: SelectDeck["filters"] = params.filters
    ? JSON.parse(params.filters)
    : {};
  const showReverse = params.showReverse === "true";

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
        onClose={handleClose}
        showReverse={showReverse}
      />
    </View>
  );
}
