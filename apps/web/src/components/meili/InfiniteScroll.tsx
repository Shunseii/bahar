import { Trans } from "@lingui/react/macro";
import { FC, useEffect, useState } from "react";
import {
  Highlight,
  Snippet,
  UseInfiniteHitsProps,
  useInfiniteHits,
  useInstantSearch,
} from "react-instantsearch";
import { useMeasure, useWindowScroll } from "@uidotdev/usehooks";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { useCountdown } from "@/hooks/useCountdown";
import { Edit } from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";

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

const SkeletonHits = () => {
  return (
    <ul className="flex flex-col gap-y-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <li key={index}>
          <article>
            <div className="flex flex-col gap-y-2">
              <span dir="rtl" className="rtl:text-right">
                <Skeleton className="h-9 w-[150px]" />
              </span>

              <span dir="ltr" className="ltr:text-left">
                <Skeleton className="h-6 w-[250px]" />
              </span>
            </div>

            <Separator className="mt-4" />
          </article>
        </li>
      ))}
    </ul>
  );
};

export const InfiniteScroll: FC<UseInfiniteHitsProps> = (props) => {
  const navigate = useNavigate();
  /**
   * This is true if we have not queried search results at all.
   * Used to determine if the loading state is shown for the first time.
   * If it is, we want to show the skeleton loading state.
   * If we've already loading results once before, then we don't
   * want to show the skeleton loading state.
   */
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  /**
   * The countdown is used to add a delay to the initial loading state
   * to avoid flickering.
   */
  const { isCountdownComplete } = useCountdown(1000);
  const { status } = useInstantSearch();
  const { items: hits, showMore, isLastPage } = useInfiniteHits<Hit>(props);
  const [ref, { height }] = useMeasure();
  const [{ y }] = useWindowScroll();

  // Check that the window dimensions are available
  const heightisLoaded = height !== null && height > 0 && y !== null;

  // Check if we are close to the bottom of the page
  const shouldLoadMore = heightisLoaded
    ? height - y <= PIXEL_HEIGHT_OFFSET
    : false;

  // Add an extra one second delay so that initial loading state doesn't flicker
  const isInitialLoading =
    (status === "loading" && isFirstLoad) || !isCountdownComplete;

  useEffect(() => {
    if (status === "idle" && isCountdownComplete) {
      setIsFirstLoad(false);
    }
  }, [status, isCountdownComplete]);

  useEffect(() => {
    if (shouldLoadMore && !isLastPage && status === "idle") {
      showMore();
    }
  }, [shouldLoadMore]);

  if (!isInitialLoading && !hits.length) {
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
      {isInitialLoading ? (
        <SkeletonHits />
      ) : (
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

                  <h2 dir="rtl" className="rtl:text-right">
                    <Highlight
                      className="text-3xl"
                      attribute="word"
                      hit={hit}
                    />
                  </h2>

                  <p dir="ltr" className="ltr:text-left">
                    <Snippet attribute="translation" hit={hit} />
                  </p>
                </div>

                <Separator className="mt-4" />
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
