import { FlashcardState } from "@bahar/drizzle-user-db-schemas";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db";
import {
  InsertRevlogsSchema,
  REVLOG_RATINGS,
  revlogs,
} from "../db/schema/revlogs";
import { betterAuthGuard } from "../middleware";

const RevlogBodySchema = InsertRevlogsSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  due_timestamp_ms: true,
  review_timestamp_ms: true,
  rating: true,
}).extend({
  due: z.iso.datetime(),
  review: z.iso.datetime(),
  rating: z.enum(REVLOG_RATINGS).optional(),
});

export const statsRouter = new Elysia({ prefix: "/stats" })
  .use(betterAuthGuard)
  .post(
    "/revlogs",
    async ({ user, body }) => {
      const id = nanoid();
      const userId = user.id;
      const due_timestamp_ms = new Date(body.due).getTime();
      const review_timestamp_ms = new Date(body.review).getTime();

      await db.insert(revlogs).values({
        ...body,
        id,
        user_id: userId,
        due_timestamp_ms,
        review_timestamp_ms,
      });

      return { success: true } as const;
    },
    {
      auth: "user",
      body: RevlogBodySchema,
    }
  )
  .post(
    "/revlogs/batch",
    async ({ user, body }) => {
      const userId = user.id;

      const values = body.entries.map((entry) => ({
        ...entry,
        id: nanoid(),
        user_id: userId,
        due_timestamp_ms: new Date(entry.due).getTime(),
        review_timestamp_ms: new Date(entry.review).getTime(),
      }));

      await db.insert(revlogs).values(values);

      return { success: true } as const;
    },
    {
      auth: "user",
      body: z.object({
        entries: z.array(RevlogBodySchema),
      }),
    }
  )
  .get(
    "/retention",
    async ({ user }) => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * oneDayMs;
      const fourteenDaysAgo = now - 14 * oneDayMs;

      const rows = await db
        .select({
          rating: revlogs.rating,
          reviewTimestampMs: revlogs.review_timestamp_ms,
        })
        .from(revlogs)
        .where(
          and(
            eq(revlogs.user_id, user.id),
            eq(revlogs.source, "review"),
            eq(revlogs.state, FlashcardState.REVIEW),
            isNotNull(revlogs.rating),
            gte(revlogs.review_timestamp_ms, fourteenDaysAgo)
          )
        );

      const thisWeek = rows.filter((r) => r.reviewTimestampMs >= sevenDaysAgo);
      const lastWeek = rows.filter(
        (r) =>
          r.reviewTimestampMs >= fourteenDaysAgo &&
          r.reviewTimestampMs < sevenDaysAgo
      );

      const computeRate = (reviews: typeof rows) => {
        if (reviews.length === 0) return null;
        const passed = reviews.filter((r) => r.rating !== "again").length;
        return passed / reviews.length;
      };

      const currentRate = computeRate(thisWeek);
      const previousRate = computeRate(lastWeek);

      const trend =
        currentRate !== null && previousRate !== null
          ? currentRate - previousRate
          : null;

      return {
        rate: currentRate,
        trend,
        reviewCount: thisWeek.length,
      };
    },
    {
      auth: "user",
    }
  );
