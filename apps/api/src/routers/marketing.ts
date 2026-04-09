import { desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import type { ContactDeletedEvent, ContactUpdatedEvent } from "resend";
import { z } from "zod";
import { resend } from "../clients/mail";
import { db } from "../db";
import { consentEvents, users } from "../db/schema/auth";
import { betterAuthGuard } from "../middleware";
import { config } from "../utils/config";
import { LogCategory, logger } from "../utils/logger";

const ConsentBodySchema = z.object({
  consent: z.boolean(),
  source: z.enum(["app_modal", "app_settings"]),
});

const getLatestConsentEvent = async (userId: string) => {
  const [latest] = await db
    .select()
    .from(consentEvents)
    .where(eq(consentEvents.userId, userId))
    .orderBy(desc(consentEvents.createdAt))
    .limit(1);

  return latest ?? null;
};

const hasAnyConsentEvent = async (userId: string) => {
  const [row] = await db
    .select({ id: consentEvents.id })
    .from(consentEvents)
    .where(eq(consentEvents.userId, userId))
    .limit(1);

  return !!row;
};

export const marketingRouter = new Elysia({ prefix: "/marketing" })
  .use(betterAuthGuard)
  .get(
    "/consent",
    async ({ user }) => {
      const latest = await getLatestConsentEvent(user.id);

      return { consent: latest };
    },
    {
      auth: "user",
    }
  )
  .post(
    "/consent",
    async ({ user, body, request, server }) => {
      const action = body.consent ? "granted" : "withdrawn";
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-real-ip") ??
        server?.requestIP(request)?.address ??
        null;

      const contactExists = await hasAnyConsentEvent(user.id);

      await db.insert(consentEvents).values({
        id: nanoid(),
        userId: user.id,
        action,
        source: body.source,
        ipAddress,
      });

      const marketingLogger = logger.child({
        category: LogCategory.APPLICATION,
        userId: user.id,
        action,
      });

      try {
        if (contactExists) {
          await resend.contacts.update({
            email: user.email,
            unsubscribed: !body.consent,
          });
        } else {
          await resend.contacts.create({
            email: user.email,
            unsubscribed: !body.consent,
            ...(config.RESEND_SEGMENT_ID && {
              segments: [{ id: config.RESEND_SEGMENT_ID }],
            }),
          });
        }
      } catch (error) {
        marketingLogger.error(
          { event: "resend_contact_sync.error", error },
          "Failed to sync contact with Resend"
        );
      }

      return { success: true } as const;
    },
    {
      auth: "user",
      body: ConsentBodySchema,
    }
  )
  .post("/webhook/resend", async ({ request }) => {
    const webhookLogger = logger.child({
      category: LogCategory.APPLICATION,
      event: "resend_webhook",
    });

    const payload = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      webhookLogger.warn("Missing svix headers");
      return new Response("Missing headers", { status: 400 });
    }

    let event;
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret: config.RESEND_WEBHOOK_SECRET,
      });
    } catch (error) {
      webhookLogger.error(
        { error },
        "Failed to verify Resend webhook signature"
      );
      return new Response("Invalid signature", { status: 401 });
    }

    const consentAction = (() => {
      if (event.type === "contact.deleted") {
        const { email } = (event as ContactDeletedEvent).data;
        return { email, action: "withdrawn" as const };
      }

      if (event.type === "contact.updated") {
        const { email, unsubscribed } = (event as ContactUpdatedEvent).data;
        return {
          email,
          action: unsubscribed ? ("withdrawn" as const) : ("granted" as const),
        };
      }

      return null;
    })();

    if (!consentAction) {
      return { received: true };
    }

    const { email, action } = consentAction;

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (!existingUser) {
      webhookLogger.warn({ email }, "Received webhook for unknown email");
      return { received: true };
    }

    const latest = await getLatestConsentEvent(existingUser.id);

    if (latest?.action === action) {
      return { received: true };
    }

    await db.insert(consentEvents).values({
      id: nanoid(),
      userId: existingUser.id,
      action,
      source: "resend_webhook",
    });

    webhookLogger.info(
      { userId: existingUser.id, email, action, eventType: event.type },
      "Processed Resend webhook"
    );

    return { received: true };
  });
