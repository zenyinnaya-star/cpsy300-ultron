// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Takes each review off the Service Bus queue "reviews" and stores it in Cosmos DB.
// The web app only drops the review on the queue and answers the visitor straight away;
// this function does the slow part. Phase 3 adds the AI step here.
import { app, InvocationContext } from "@azure/functions";
import { getStore } from "../lib/store";
import type { Review } from "../lib/types";

// The message body arrives as bytes, a string or an object, depending on how it was sent.
function readBody(message: unknown): Record<string, unknown> | null {
  try {
    if (Buffer.isBuffer(message)) return JSON.parse(message.toString("utf8"));
    if (typeof message === "string") return JSON.parse(message);
    if (message && typeof message === "object") return message as Record<string, unknown>;
  } catch { /* not JSON */ }
  return null;
}

export function toReview(body: Record<string, unknown> | null, messageId: string): Review | null {
  if (!body) return null;
  const rating = Number(body.rating);
  const recipeId = String(body.recipeId ?? "").trim();
  if (!recipeId || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return {
    id: messageId,
    recipeId,
    recipeName: String(body.recipeName ?? "").trim().slice(0, 200),
    diet: String(body.diet ?? "").trim().toLowerCase().slice(0, 40),
    rating,
    comment: String(body.comment ?? "").trim().slice(0, 500),
    createdAt: typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString(),
  };
}

export async function storeReview(message: unknown, context: InvocationContext): Promise<void> {
  const messageId = String(context.triggerMetadata?.messageId ?? context.invocationId);
  const review = toReview(readBody(message), messageId);
  if (!review) {
    // Bad input will never get better by retrying: log it and let the message complete.
    context.warn(`rejected review messageId=${messageId}`);
    return;
  }
  await getStore().saveReview(review); // id = message id, so a redelivered message overwrites itself
  context.log(`stored review messageId=${messageId} recipeId=${review.recipeId} rating=${review.rating} deliveryCount=${context.triggerMetadata?.deliveryCount}`);
}

app.serviceBusQueue("storeReview", { connection: "ServiceBusConnection", queueName: "reviews", handler: storeReview });
