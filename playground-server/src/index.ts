import { Log, LogLevel } from "logepi";

import mountApi from "./api";
import NodeWrapper from "./node";

const BANNED_MNEMONICS = [
  "science amused table oyster text message core mirror patch bubble provide industry",
  "impulse exile artwork when toss canal entire electric protect custom adult erupt"
];

Log.setOutputLevel((process.env.API_LOG_LEVEL as LogLevel) || LogLevel.INFO);

const API_TIMEOUT = 5 * 60 * 1000;

(async () => {
  const nodeMnemonic = process.env.NODE_MNEMONIC;
  if (nodeMnemonic && BANNED_MNEMONICS.indexOf(nodeMnemonic) !== -1) {
    throw Error(
      "Old shared NODE_MNEMONIC found; exiting. See https://github.com/counterfactual/monorepo/pull/1064/files for more information."
    );
  }
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

export * from "./types";
