import { Log, LogLevel } from "logepi";

import mountApi from "./api";
import NodeWrapper from "./node";

Log.setOutputLevel((process.env.API_LOG_LEVEL as LogLevel) || LogLevel.INFO);

(async () => {
  await NodeWrapper.createNodeSingleton("ropsten");

  const api = mountApi();
  const port = process.env.PORT || 9000;
  await api.listen(port);
  Log.info("API is now ready", { tags: { port } });
})();

export * from "./types";
