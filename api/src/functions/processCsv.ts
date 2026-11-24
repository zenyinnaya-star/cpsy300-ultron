// CPSY 300 Team Project, Phase 2 — GIVEN CODE. Copy this file into your repository exactly where the starter
// zip puts it. You may change it, but explain any change in your report.

// Runs once for each CSV uploaded to the "uploads" container.
// Trigger: an Event Grid event "Blob Created" — the only kind of blob trigger Flex Consumption supports.
// It cleans the file, works out the insights, and stores both in Cosmos DB, so that every page view
// afterwards is a cheap database read instead of a fresh calculation.
import { app, InvocationContext } from "@azure/functions";
import { analyseCsv } from "../lib/clean";
import { getStore } from "../lib/store";

export async function processCsv(blob: unknown, context: InvocationContext): Promise<void> {
  const name = String(context.triggerMetadata?.name ?? "unknown");
  const started = Date.now();

  if (!name.toLowerCase().endsWith(".csv")) {
    context.log(`skipped blob=${name} reason=not-a-csv`);
    return;
  }

  const text = Buffer.isBuffer(blob) ? blob.toString("utf8") : String(blob);
  const { recipes, insights } = analyseCsv(text);

  // A file with no usable rows must not wipe the data the site is showing.
  if (recipes.length === 0) {
    context.warn(`rejected blob=${name} reason=no-usable-rows rowsRead=${insights.quality.rowsRead}`);
    return;
  }

  const store = getStore();
  const datasetVersion = `${name}@${new Date().toISOString()}`;
  const up = await store.upsertRecipes(recipes, datasetVersion);
  if (up.failed > 0) {
    // Throwing makes the Functions runtime retry the whole run; the writes are upserts with
    // fixed ids, so running twice is safe.
    throw new Error(`processCsv: ${up.failed} of ${recipes.length} writes failed for ${name}`);
  }
  const del = await store.deleteOtherVersions(datasetVersion);
  await store.saveInsights({ id: "current", ...insights, datasetVersion, sourceBlob: name, processedAt: new Date().toISOString() });

  // One line per run, in a fixed shape, so it is easy to find in the logs (the traces table).
  context.log(
    `processed blob=${name} rowsRead=${insights.quality.rowsRead} rowsUsed=${insights.quality.rowsUsed} ` +
      `written=${up.written} deleted=${del.deleted} ru=${up.ru + del.ru} ms=${Date.now() - started}`,
  );
}

app.storageBlob("processCsv", {
  path: "uploads/{name}",
  // Its own connection, as Microsoft recommends for anything that is not the Functions host itself.
  // In Azure: UploadsStorage__blobServiceUri + UploadsStorage__queueServiceUri +
  // UploadsStorage__credential=managedidentity (no key), as in Week 7 Day 2.
  connection: "UploadsStorage",
  source: "EventGrid",
  handler: processCsv,
});
