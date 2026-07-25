import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { UpdateBanner } from "./UpdateBanner";
import { UpdateRestartModal } from "./UpdateRestartModal";

/**
 * Renders whichever stage of the OTA update flow is current. Mounted once
 * alongside the drawer so the prompt survives screen changes, and kept out of
 * the review screen -- a sibling route -- so a flashcard session isn't
 * interrupted by it.
 */
export const UpdatePrompt = () => {
  const { status, downloadProgress, startDownload, restart, dismiss } =
    useOtaUpdate();

  return (
    <>
      {(status === "available" || status === "downloading") && (
        <UpdateBanner
          downloadProgress={downloadProgress}
          onUpdate={startDownload}
          status={status}
        />
      )}

      <UpdateRestartModal
        onLater={dismiss}
        onRestart={restart}
        visible={status === "ready"}
      />
    </>
  );
};
