import { Log, LogLevel } from "logepi";

import mountApi from "./api";
import { detectDBAndSchema } from "./db";
import { NodeWrapper, serviceFactoryPromise } from "./node";

const BANNED_MNEMONICS = new Set([
  "science amused table oyster text message core mirror patch bubble provide industry",
  "impulse exile artwork when toss canal entire electric protect custom adult erupt"
]);

const NO_MNEMONIC_MESSAGE =
  'Error: No mnemonic specified in the NODE_MNEMONIC env var.\n\
Please set one by following the instructions in the README, \
section "Funding the Hub Account for Playground Testing".\n';

Log.setOutputLevel((process.env.API_LOG_LEVEL as LogLevel) || LogLevel.INFO);

const API_TIMEOUT = 5 * 60 * 1000;

(async () => {
  const nodeMnemonic = process.env.NODE_MNEMONIC;
  if (!nodeMnemonic) {
    console.error(NO_MNEMONIC_MESSAGE);
    process.exit(1);
  }

  if (BANNED_MNEMONICS.has(nodeMnemonic!)) {
    console.error(
      "Old shared NODE_MNEMONIC found; exiting. See https://github.com/counterfactual/monorepo/pull/1064/files for more information."
    );
    process.exit(1);
  }

  await detectDBAndSchema();

  await NodeWrapper.createNodeSingleton(
    process.env.ETHEREUM_NETWORK || "kovan",
    process.env.NODE_MNEMONIC
  );

  const api = mountApi();
  const port = process.env.PORT || 9000;

  const server = await api.listen(port);
  server.setTimeout(API_TIMEOUT);

  Log.info("API is now ready", { tags: { port } });
})();

process.on("SIGINT", async () => {
  console.log("Shutting down simple-hub-server...");
  const serviceFactory = await serviceFactoryPromise;
  await serviceFactory.closeServiceConnections();
  process.exit(0);
});

export * from "./types";
