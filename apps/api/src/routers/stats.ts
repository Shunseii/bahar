import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db";
import { InsertRevlogsSchema, revlogs } from "../db/schema/revlogs";
import { betterAuthGuard } from "../middleware";

const RevlogBodySchema = InsertRevlogsSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  due_timestamp_ms: true,
  review_timestamp_ms: true,
}).extend({
  due: z.iso.datetime(),
  review: z.iso.datetime(),
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
  );
