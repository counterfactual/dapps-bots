import { AppInstance, StateChannel } from "@counterfactual/machine";
import {
  Address,
  AppInstanceInfo,
  AppInterface,
  Node,
  Terms
} from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { v4 as generateUUID } from "uuid";

import { ProposedAppInstanceInfo } from "../models";
import { NodeMessage } from "../node";
import { Store } from "../store";
import {
  getChannelFromPeerAddress,
  getPeersAddressFromAppInstanceID
} from "../utils";

import { ERRORS } from "./errors";
import { RequestHandler } from "./request-handler";

/**
 * This creates an entry of a proposed app instance into the relevant channel
 * while sending the proposal to the peer with whom this app instance is
 * indicated to be instantiated with.
 * @param params
 * @returns The AppInstanceId for the proposed AppInstance
 */
export async function proposeAppInstanceInstall(
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
 * This converts a proposed app instance to an installed app instance while
 * sending an approved ack to the proposer.
 * @param params
 */
export async function installAppInstance(
  this: RequestHandler,
  params: Node.InstallParams
): Promise<Node.InstallResult> {
  const appInstance = await install(this.store, params);

  const [peerAddress] = await getPeersAddressFromAppInstanceID(
    this.selfAddress,
    this.store,
    appInstance.id
  );

  const installApprovalMsg: NodeMessage = {
    from: this.selfAddress,
    event: Node.EventName.INSTALL,
    data: {
      appInstanceId: appInstance.id,
      proposal: false
    }
  };

  await this.messagingService.send(peerAddress, installApprovalMsg);
  return {
    appInstance
  };
}

/**
 * This creates an entry of a proposed Virtual AppInstance while sending the
 * proposal to the intermediaries and peer with whom this app instance is
 * indicated to be instantiated with.
 * @param params
 * @returns The AppInstanceId for the proposed AppInstance
 */
export async function proposeAppInstanceVirtualInstall(
  this: RequestHandler,
  params: Node.ProposeInstallVirtualParams
): Promise<Node.ProposeInstallVirtualResult> {
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
 * This function adds the app instance as a pending installation if the proposal
 * flag is set. Otherwise it adds the app instance as an installed app into the
 * appropriate channel.
 */
export async function addAppInstance(
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

/**
 * Creates a ProposedAppInstanceInfo to reflect the proposal received from
 * the client.
 * @param selfAddress
 * @param store
 * @param params
 */
async function createProposedAppInstance(
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

export async function install(
  store: Store,
  params: Node.InstallParams
): Promise<AppInstanceInfo> {
  const { appInstanceId } = params;
  if (
    !appInstanceId ||
    (typeof appInstanceId === "string" && appInstanceId.trim() === "")
  ) {
    return Promise.reject(ERRORS.NO_APP_INSTANCE_ID_TO_INSTALL);
  }

  const appInstanceInfo = await store.getProposedAppInstanceInfo(appInstanceId);
  const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);
  const appInstance = createAppInstanceFromAppInstanceInfo(
    appInstanceInfo,
    stateChannel
  );
  delete appInstanceInfo.initialState;

  const updatedStateChannel = stateChannel.installApp(
    appInstance,
    appInstanceInfo.myDeposit,
    appInstanceInfo.peerDeposit
  );

  await store.updateChannelWithAppInstanceInstallation(
    updatedStateChannel,
    appInstance,
    appInstanceInfo
  );

  return appInstanceInfo;
}

/**
 * @param appInstanceInfo The AppInstanceInfo to convert
 * @param channel The channel the AppInstanceInfo belongs to
 */
function createAppInstanceFromAppInstanceInfo(
  proposedAppInstanceInfo: ProposedAppInstanceInfo,
  channel: StateChannel
): AppInstance {
  const appInterface: AppInterface = {
    addr: proposedAppInstanceInfo.appId,
    stateEncoding: proposedAppInstanceInfo.abiEncodings.stateEncoding,
    actionEncoding: proposedAppInstanceInfo.abiEncodings.actionEncoding
  };

  // TODO: throw if asset type is ETH and token is also set
  const terms: Terms = {
    assetType: proposedAppInstanceInfo.asset.assetType,
    limit: proposedAppInstanceInfo.myDeposit.add(
      proposedAppInstanceInfo.peerDeposit
    ),
    token: proposedAppInstanceInfo.asset.token
      ? proposedAppInstanceInfo.asset.token
      : AddressZero
  };

  return new AppInstance(
    channel.multisigAddress,
    // TODO: generate ephemeral app-specific keys
    channel.multisigOwners,
    proposedAppInstanceInfo.timeout.toNumber(),
    appInterface,
    terms,
    // TODO: pass correct value when virtual app support gets added
    false,
    // TODO: this should be thread-safe
    channel.numInstalledApps,
    channel.rootNonceValue,
    proposedAppInstanceInfo.initialState,
    0,
    proposedAppInstanceInfo.timeout.toNumber()
  );
}

async function setAppInstanceIDForProposeInstall(
  selfAddress: Address,
  store: Store,
  params: Node.InterNodeProposeInstallParams
) {
  const channel = await getChannelFromPeerAddress(
    selfAddress,
    params.peerAddress,
    store
  );
  const proposedAppInstance = new ProposedAppInstanceInfo(
    params.appInstanceId,
    params
  );

  await store.addAppInstanceProposal(channel, proposedAppInstance);
}
