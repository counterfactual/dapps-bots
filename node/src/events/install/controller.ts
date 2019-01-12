import { install } from "../../methods/app-instance/install/operation";
import { NodeMessage } from "../../node";
import { RequestHandler } from "../../request-handler";

import { setAppInstanceIDForProposeInstall } from "./operation";
/**
 * This function adds the AppInstance as a proposed installation if the proposal
 * flag is set. Otherwise it adds the AppInstance as an installed app into the
 * appropriate channel.
 */
export async function installEventController(
  this: RequestHandler,
  nodeMsg: NodeMessage
) {
  const params = { ...nodeMsg.data };
  params.peerAddress = nodeMsg.from!;
  delete params.proposal;
  if (nodeMsg.data.proposal) {
    await setAppInstanceIDForProposeInstall(
      this.selfAddress,
      this.store,
      params
    );
  } else {
    await install(this.store, params);
  }
}
