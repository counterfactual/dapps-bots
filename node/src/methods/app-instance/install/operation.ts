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

  // TODO: Use the instructionExecutor variable to `runInstallProtocol`

  await store.updateChannelWithAppInstanceInstallation(
    stateChannel.installApp(
      appInstance,
      appInstanceInfo.myDeposit,
      appInstanceInfo.peerDeposit
    ),
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
    ...proposedAppInstanceInfo.abiEncodings,
    addr: proposedAppInstanceInfo.appId
  };

  // TODO: throw if asset type is ETH and token is also set
  const terms: Terms = {
    assetType: proposedAppInstanceInfo.asset.assetType,
    limit: proposedAppInstanceInfo.myDeposit.add(
      proposedAppInstanceInfo.peerDeposit
    ),
    token: proposedAppInstanceInfo.asset.token || AddressZero
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
