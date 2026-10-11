// Apify entry point: read the input, run, save rows to the default dataset, exit with a plain status line.
import { Actor, log } from "apify";
import { explain, run, type Input } from "./lib.js";

await Actor.init();

// Rows are saved page by page, so an abort loses nothing already fetched: just stop.
Actor.on("aborting", async () => {
  await Actor.exit("Aborted. Rows saved before the abort are in the dataset.");
});

try {
  const input = (await Actor.getInput<Input>()) ?? {};
  const summary = await run(input, {
    push: (rows) => Actor.pushData(rows),
    note: (message) => {
      log.info(message);
      return Actor.setStatusMessage(message);
    },
  });
  log.info(summary.message);
  await Actor.exit(summary.message);
} catch (err) {
  const message = explain(err);
  log.error(message);
  await Actor.fail(message);
}
