// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Puts a review on the Service Bus queue. Signs in with the container app's managed identity —
// there is no connection string. On your laptop, DefaultAzureCredential uses your `az login`.
import { ServiceBusClient } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "node:crypto";

let client: ServiceBusClient | null = null;

export async function sendReview(review: {
  recipeId: string; recipeName: string; diet: string; rating: number; comment: string;
}) {
  const ns = process.env.SERVICEBUS_NAMESPACE;            // e.g. sb-cpsy300-team1.servicebus.windows.net
  const queue = process.env.REVIEWS_QUEUE ?? "reviews";
  if (!ns) throw new Error("The environment variable SERVICEBUS_NAMESPACE is missing.");
  // Give up after about half a minute instead of several, so a visitor is never left waiting.
  client ??= new ServiceBusClient(ns, new DefaultAzureCredential(), { retryOptions: { maxRetries: 2, timeoutInMs: 10000 } });
  const sender = client.createSender(queue);
  try {
    await sender.sendMessages({
      messageId: randomUUID(),
      contentType: "application/json",
      // Sent as bytes of JSON text, so a receiver in any language reads the same thing.
      body: Buffer.from(JSON.stringify({ ...review, createdAt: new Date().toISOString() })),
    });
  } finally {
    await sender.close();
  }
}
