import { Trans } from "@lingui/react/macro";
import { Download, Loader } from "lucide-react-native";
import { type FC, useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { useThemeColors } from "@/lib/theme";

interface UpdateBannerProps {
  status: "available" | "downloading";
  downloadProgress: number | undefined;
  onUpdate: () => void;
}

export const UpdateBanner: FC<UpdateBannerProps> = ({
  status,
  downloadProgress,
  onUpdate,
}) => {
  const { primary } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute inset-x-4 z-50"
      role="alert"
      // Offset by the real bottom inset so the banner floats above the home
      // indicator instead of bleeding into the safe area on devices with one.
      style={{ bottom: insets.bottom + 16 }}
    >
      <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-lg">
        <View className="size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          {status === "available" ? (
            <Download color={primary} size={20} />
          ) : (
            <SpinningLoader color={primary} />
          )}
        </View>

        {status === "available" ? (
          <AvailableContent onUpdate={onUpdate} />
        ) : (
          <DownloadingContent progress={downloadProgress} />
        )}
      </View>
    </View>
  );
};

const AvailableContent: FC<{ onUpdate: () => void }> = ({ onUpdate }) => (
  <>
    <View className="flex-1 gap-0.5">
      <Text className="font-semibold text-foreground text-sm">
        <Trans>Update available</Trans>
      </Text>

      <Text className="text-muted-foreground text-xs">
        <Trans>A new version is ready to install.</Trans>
      </Text>
    </View>

    <Pressable
      onPress={onUpdate}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="h-9 items-center justify-center rounded-lg bg-primary px-3.5">
        <Text className="font-semibold text-primary-foreground text-sm">
          <Trans>Update</Trans>
        </Text>
      </View>
    </Pressable>
  </>
);

const DownloadingContent: FC<{ progress: number | undefined }> = ({
  progress,
}) => {
  const { formatNumber } = useFormatNumber();

  return (
    <View className="flex-1 gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-foreground text-sm">
          <Trans>Downloading update</Trans>
        </Text>

        {progress !== undefined && (
          <Text className="font-semibold text-primary text-xs">
            {`${formatNumber(Math.round(progress * 100))}%`}
          </Text>
        )}
      </View>

      <ProgressBar progress={progress} />
    </View>
  );
};

/**
 * Fraction of the track the sweeping segment covers when no real progress is
 * available, and how long one pass takes.
 */
const SWEEP_WIDTH_RATIO = 0.35;
const SWEEP_DURATION_MS = 1200;

/**
 * Determinate when expo-updates reports a fraction, which needs the asset
 * server to send Content-Length. Otherwise a looping sweep -- there is no
 * percentage to be had, so showing one would be inventing it.
 */
const ProgressBar: FC<{ progress: number | undefined }> = ({ progress }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useSharedValue(0);
  const isIndeterminate = progress === undefined;
  const segmentWidth = trackWidth * SWEEP_WIDTH_RATIO;

  useEffect(() => {
    if (!isIndeterminate || trackWidth === 0) return;

    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, {
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, [isIndeterminate, trackWidth, sweep]);

  // Travels from fully off the leading edge to fully off the trailing one.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: -segmentWidth + sweep.value * (trackWidth + segmentWidth),
      },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      className="h-1.5 overflow-hidden rounded-full bg-border"
      onLayout={onLayout}
    >
      {isIndeterminate ? (
        <Animated.View
          className="h-full rounded-full bg-primary"
          style={[{ width: segmentWidth }, sweepStyle]}
        />
      ) : (
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      )}
    </View>
  );
};

const SPIN_DURATION_MS = 1000;

const SpinningLoader: FC<{ color: string }> = ({ color }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: SPIN_DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Loader color={color} size={20} />
    </Animated.View>
  );
};
