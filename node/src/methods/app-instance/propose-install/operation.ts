import { Node } from "@counterfactual/types";

import { ProposedAppInstanceInfo } from "../../../models";
import { Store } from "../../../store";
import { getStateChannelWithOwners } from "../../../utils";

/**
 * Creates a ProposedAppInstanceInfo to reflect the proposal received from
 * the client.
 * @param myIdentifier
 * @param store
 * @param params
 */
export async function createProposedAppInstance(
  myIdentifier: string,
  store: Store,
  params: Node.ProposeInstallParams
): Promise<string> {
  const channel = await getStateChannelWithOwners(
    myIdentifier,
    params.proposedToIdentifier,
    store
  );

  const proposedAppInstanceInfo = new ProposedAppInstanceInfo(
    {
      ...params,
      proposedByIdentifier: myIdentifier
    },
    channel
  );

  await store.addAppInstanceProposal(channel, proposedAppInstanceInfo);

  return proposedAppInstanceInfo.identityHash;
}
