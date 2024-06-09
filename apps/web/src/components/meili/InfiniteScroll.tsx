import { FC, useEffect } from "react";
import {
  Highlight,
  Snippet,
  UseInfiniteHitsProps,
  useInfiniteHits,
  useInstantSearch,
} from "react-instantsearch";
import { useMeasure, useWindowScroll } from "@uidotdev/usehooks";
import { Separator } from "../ui/separator";

/**
 * The difference in the height of the infinite list and the
 * window's scroll position at which we kick off the next query
 * for the infinite list.
 *
 * This should be a value that "feels good."
 */
const PIXEL_HEIGHT_OFFSET = 800;

interface Hit extends Record<string, unknown> {
  id?: string;
  content?: string;
  translation?: string;
}

export const InfiniteScroll: FC<UseInfiniteHitsProps> = (props) => {
  const { status } = useInstantSearch();
  const { hits, showMore, isLastPage } = useInfiniteHits<Hit>(props);
  const [ref, { height }] = useMeasure();
  const [{ y }] = useWindowScroll();

  const heightisLoaded = height !== null && height > 0 && y !== null;

  const shouldLoadMore = heightisLoaded
    ? height - y <= PIXEL_HEIGHT_OFFSET
    : false;

  useEffect(() => {
    if (shouldLoadMore && !isLastPage && status === "idle") {
      showMore();
    }
  }, [shouldLoadMore]);

  return (
    <div>
      <ul className="flex flex-col gap-y-4" ref={ref}>
        {hits.map((hit) => (
          <li key={hit.id}>
            <article>
              <div className="flex flex-col gap-y-2">
                <h2 dir="rtl" className="rtl:text-right">
                  <Highlight
                    className="text-3xl"
                    attribute="content"
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
    </div>
  );
};
