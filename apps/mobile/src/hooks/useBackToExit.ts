import { useBottomSheetModal } from "@gorhom/bottom-sheet";
import { t } from "@lingui/core/macro";
import { useDrawerStatus } from "@react-navigation/drawer";
import { DrawerActions } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { toast } from "sonner-native";
import { useBulkSelection } from "@/lib/store/selection";
import { useOpenSheetCount } from "@/lib/store/sheets";

/**
 * How long the second back press has to arrive to close the app. Android's own
 * double-back pattern sits around two seconds.
 */
const CONFIRM_WINDOW_MS = 2000;

/**
 * Whether a back press should close the app: only when it follows another one
 * closely enough to read as deliberate.
 */
export const shouldExitOnBack = ({
  lastPressAt,
  now,
  windowMs = CONFIRM_WINDOW_MS,
}: {
  lastPressAt: number | null;
  now: number;
  windowMs?: number;
}): boolean => lastPressAt !== null && now - lastPressAt <= windowMs;

/**
 * Android hardware back handling for the dictionary screen, dismissing whatever
 * is open in order before it will consider closing the app:
 *
 * 1. a bottom sheet -- @gorhom/bottom-sheet registers no back handler of its
 *    own, so without this back would skip straight past an open sheet;
 * 2. the navigation drawer -- handled explicitly rather than left to the
 *    drawer's own handler, since which handler runs first depends on
 *    registration order;
 * 3. selection mode, which back is the obvious way out of;
 * 4. nothing left, so warn, and close the app only if back comes again within a
 *    couple of seconds.
 *
 * The warn-then-exit step is why this exists at all: back is also the button
 * that closes the app from here, so dismissing a selection with it would
 * otherwise drop the user out of Bahar. There's no Expo API for the pattern --
 * it's BackHandler plus a timestamp.
 *
 * Registered through useFocusEffect so it only applies while this screen is on
 * top; pushed screens keep their normal back behaviour.
 */
export const useBackToExit = () => {
  const { selectionMode, exitSelectionMode } = useBulkSelection();
  const openSheetCount = useOpenSheetCount();
  const { dismissAll } = useBottomSheetModal();
  const drawerStatus = useDrawerStatus();
  const navigation = useNavigation();
  const lastPressRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (openSheetCount > 0) {
            dismissAll();

            return true;
          }

          if (drawerStatus === "open") {
            navigation.dispatch(DrawerActions.closeDrawer());

            return true;
          }

          if (selectionMode) {
            exitSelectionMode();
            lastPressRef.current = null;

            return true;
          }

          if (
            shouldExitOnBack({
              lastPressAt: lastPressRef.current,
              now: Date.now(),
            })
          ) {
            return false;
          }

          lastPressRef.current = Date.now();
          toast(t`Press back again to exit`);

          return true;
        }
      );

      return () => subscription.remove();
    }, [
      dismissAll,
      drawerStatus,
      exitSelectionMode,
      navigation,
      openSheetCount,
      selectionMode,
    ])
  );
};
