import { Trans } from "@lingui/react/macro";
import { FC, useEffect } from "react";
import { useMeasure, useWindowScroll } from "@uidotdev/usehooks";
import { Separator } from "../ui/separator";
import { Edit } from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteScroll } from "@/hooks/useSearch";
import { useAtomValue } from "jotai";
import { searchQueryAtom } from "./state";
import { Highlight } from "./Highlight";

/**
 * The difference in the height of the infinite list and the
 * window's scroll position at which we kick off the next query
 * for the infinite list.
 *
 * This should be a value that "feels good."
 */
const PIXEL_HEIGHT_OFFSET = 800;

export interface Hit extends Record<string, unknown> {
  id?: string;
  word?: string;
  translation?: string;
}

export const InfiniteScroll: FC = () => {
  const navigate = useNavigate();
  const searchQuery = useAtomValue(searchQueryAtom);
  const {
    results: { hits } = {},
    showMore,
    hasMore,
  } = useInfiniteScroll({ term: searchQuery });
  const [ref, { height }] = useMeasure();
  const [{ y }] = useWindowScroll();

  // Check that the window dimensions are available
  const heightisLoaded = height !== null && height > 0 && y !== null;

  // Check if we are close to the bottom of the page
  const shouldLoadMore = heightisLoaded
    ? height - y <= PIXEL_HEIGHT_OFFSET
    : false;

  useEffect(() => {
    if (shouldLoadMore && hasMore) {
      showMore();
    }
  }, [shouldLoadMore]);

  if (!hits?.length) {
    return (
      <div className="flex flex-col gap-y-4">
        <p>
          <Trans>You have no words in your dictionary yet.</Trans>
        </p>

        <p>
          <Trans>Add some to get started!</Trans>
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-y-4" ref={ref}>
        {hits.map((hit) => (
          <li key={hit.id}>
            <article>
              <div className="flex flex-col gap-y-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  onClick={() =>
                    navigate({
                      to: `/dictionary/edit/$wordId`,
                      params: { wordId: hit.id! },
                    })
                  }
                >
                  <Edit className="w-4 h-4" />
                </Button>

                <h2 dir="rtl" className="rtl:text-right text-3xl">
                  <Highlight text={hit.document.word} />
                </h2>

                <p dir="ltr" className="ltr:text-left">
                  <Highlight text={hit.document.translation} />
                </p>
              </div>

              <Separator className="mt-4" />
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
};
