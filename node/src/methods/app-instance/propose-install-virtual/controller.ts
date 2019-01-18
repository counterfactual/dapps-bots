import { Node } from "@counterfactual/types";

import { RequestHandler } from "../../../request-handler";
import { NODE_EVENTS, ProposeVirtualMessage } from "../../../types";
import { ERRORS } from "../../errors";

import {
  createProposedVirtualAppInstance,
  getNextNodeAddress
} from "./operation";

/**
 * This creates an entry of a proposed Virtual AppInstance while sending the
 * proposal to the intermediaries and the responding Node.
 * @param params
 * @returns The AppInstanceId for the proposed AppInstance
 */
export default async function proposeInstallVirtualAppInstanceController(
  requestHandler: RequestHandler,
  params: Node.ProposeInstallVirtualParams
): Promise<Node.ProposeInstallVirtualResult> {
  if (!params.initialState) {
    return Promise.reject(ERRORS.NULL_INITIAL_STATE_FOR_PROPOSAL);
  }
  // TODO: check if channel is open with the first intermediary
  // and that there are sufficient funds

  if (params.abiEncodings.actionEncoding === undefined) {
    delete params.abiEncodings.actionEncoding;
  }

  const appInstanceId = await createProposedVirtualAppInstance(
    requestHandler.address,
    requestHandler.store,
    params
  );

  const proposalMsg: ProposeVirtualMessage = {
    from: requestHandler.address,
    event: NODE_EVENTS.PROPOSE_INSTALL_VIRTUAL,
    data: {
      params,
      appInstanceId,
      initiatingAddress: requestHandler.address
    }
  };

  const nextNodeAddress = getNextNodeAddress(
    requestHandler.address,
    params.intermediaries,
    params.respondingAddress
  );

  await requestHandler.messagingService.send(nextNodeAddress, proposalMsg);

  return {
    appInstanceId
  };
}
