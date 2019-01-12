import { Address, Node } from "@counterfactual/types";
import { v4 as generateUUID } from "uuid";

import { ProposedAppInstanceInfo } from "../../../models";
import { NodeMessage } from "../../../node";
import { RequestHandler } from "../../../request-handler";
import { Store } from "../../../store";
import { getChannelFromPeerAddress } from "../../../utils";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 * @param params
 * @returns The AppInstanceId for the proposed AppInstance
 */
export async function proposeInstallAppInstanceController(
  this: RequestHandler,
  params: Node.ProposeInstallParams
): Promise<Node.ProposeInstallResult> {
  if (params.abiEncodings.actionEncoding === undefined) {
    delete params.abiEncodings.actionEncoding;
  }

  const appInstanceId = await createProposedAppInstance(
    this.selfAddress,
    this.store,
    params
  );

  const proposalMsg: NodeMessage = {
    from: this.selfAddress,
    event: Node.EventName.INSTALL,
    data: {
      ...params,
      appInstanceId,
      proposal: true
    }
  };

  await this.messagingService.send(params.peerAddress, proposalMsg);

  return {
    appInstanceId
  };
}

/**
 * Creates a ProposedAppInstanceInfo to reflect the proposal received from
 * the client.
 * @param selfAddress
 * @param store
 * @param params
 */
export async function createProposedAppInstance(
  selfAddress: Address,
  store: Store,
  params: Node.ProposeInstallParams
): Promise<string> {
  const appInstanceId = generateUUID();
  const channel = await getChannelFromPeerAddress(
    selfAddress,
    params.peerAddress,
    store
  );

  const proposedAppInstance = new ProposedAppInstanceInfo(
    appInstanceId,
    params
  );

  await store.addAppInstanceProposal(channel, proposedAppInstance);
  return appInstanceId;
}
