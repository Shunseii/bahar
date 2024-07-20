import { useWindowSize } from "@uidotdev/usehooks";

const MOBILE_WIDTH = 640; // px

export const useIsMobile = () => {
  const size = useWindowSize();
  const width = size.width ?? 0;

  return width < MOBILE_WIDTH;
};
