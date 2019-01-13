import {
  AppInstance,
  InstructionExecutor,
  StateChannel
} from "@counterfactual/machine";
import {
  AppInstanceInfo,
  AppInterface,
  Node,
  Terms
} from "@counterfactual/types";
import { AddressZero } from "ethers/constants";

import { ProposedAppInstanceInfo } from "../../../models";
import { Store } from "../../../store";
import { ERRORS } from "../../errors";

export async function install(
  store: Store,
  instructionExecutor: InstructionExecutor,
  initiatingAddress: string,
  respondingAddress: string,
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

  const updatedStateChannelMap = await instructionExecutor.runInstallProtocol(
    new Map<string, StateChannel>([
      [stateChannel.multisigAddress, stateChannel]
    ]),
    {
      initiatingAddress,
      respondingAddress,
      multisigAddress: stateChannel.multisigAddress,

      // TODO: Figure out who is alice and who is bob
      aliceBalanceDecrement: appInstanceInfo.myDeposit,
      bobBalanceDecrement: appInstanceInfo.peerDeposit,

      signingKeys: appInstance.signingKeys,
      terms: appInstance.terms,
      appInterface: appInstance.appInterface,
      initialState: appInstance.state,
      defaultTimeout: appInstance.defaultTimeout
    }
  );

  await store.updateChannelWithAppInstanceInstallation(
    updatedStateChannelMap.get(stateChannel.multisigAddress)!,
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
