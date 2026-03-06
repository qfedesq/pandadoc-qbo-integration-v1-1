import { NextResponse } from "next/server";

import { logger } from "@/lib/logging/logger";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";
import { getPublicError } from "@/lib/utils/errors";
import {
  markPandaDocWebhookEventProcessed,
  parsePandaDocWebhookEvents,
  processPandaDocWebhookEventsDefault,
  storePandaDocWebhookEvent,
  validatePandaDocWebhookSignature,
} from "@/lib/webhooks/pandadoc";

const MAX_WEBHOOK_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit({
    key: `webhook:pandadoc:${getRequestIp(request)}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit reached." }, { status: 429 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json(
      { error: "Webhook payload too large." },
      { status: 413 },
    );
  }

  const signatureValidated = validatePandaDocWebhookSignature({
    rawBody,
    request,
  });

  if (signatureValidated === false) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
    parsePandaDocWebhookEvents(payload);
  } catch (error) {
    logger.error("pandadoc.webhook_failed", { error });
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  try {
    const result = await storePandaDocWebhookEvent({
      rawBody,
      payload,
      request,
      signatureValidated,
    });

    if (!result.record.processedAt) {
      await processPandaDocWebhookEventsDefault(result.events);
      await markPandaDocWebhookEventProcessed(result.record.id);
    }

    logger.info("pandadoc.webhook_received", {
      duplicate: result.duplicate,
      signatureValidated,
    });

    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 202 : 200 },
    );
  } catch (error) {
    logger.error("pandadoc.webhook_store_failed", { error });
    const publicError = getPublicError(error);
    return NextResponse.json(
      { error: publicError.message, code: publicError.code },
      { status: publicError.statusCode },
    );
  }
}
