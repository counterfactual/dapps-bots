import { Node } from "@counterfactual/types";

import { InstructionExecutor, Protocol } from "../../../machine";
import { ProposedAppInstanceInfo, StateChannel } from "../../../models";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../models/free-balance";
import { Store } from "../../../store";
import { NO_APP_INSTANCE_ID_TO_INSTALL } from "../../errors";

export async function install(
  store: Store,
  instructionExecutor: InstructionExecutor,
  params: Node.InstallParams
): Promise<ProposedAppInstanceInfo> {
  const { appInstanceId } = params;

  if (!appInstanceId || !appInstanceId.trim()) {
    return Promise.reject(NO_APP_INSTANCE_ID_TO_INSTALL);
  }

  const appInstanceInfo = await store.getProposedAppInstanceInfo(appInstanceId);

  const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

  const stateChannelsMap = await instructionExecutor.initiateProtocol(
    Protocol.Install,
    new Map<string, StateChannel>([
      // TODO: (architectural decision) Should this use `getAllChannels` or
      //       is this good enough? InstallProtocol only operates on a single
      //       channel, anyway. PR #532 might make this question obsolete.
      [stateChannel.multisigAddress, stateChannel]
    ]),
    {
      initiatingXpub: appInstanceInfo.proposedToIdentifier,
      respondingXpub: appInstanceInfo.proposedByIdentifier,
      initiatingBalanceDecrement: appInstanceInfo.myDeposit,
      respondingBalanceDecrement: appInstanceInfo.peerDeposit,
      multisigAddress: stateChannel.multisigAddress,
      signingKeys: stateChannel.getNextSigningKeys(),
      initialState: appInstanceInfo.initialState,
      appInterface: {
        ...appInstanceInfo.abiEncodings,
        addr: appInstanceInfo.appDefinition
      },
      defaultTimeout: appInstanceInfo.timeout.toNumber(),
      outcomeType: appInstanceInfo.outcomeType,
      tokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS
    }
  );

  await store.saveStateChannel(
    stateChannelsMap.get(stateChannel.multisigAddress)!
  );

  await store.saveRealizedProposedAppInstance(appInstanceInfo);

  return appInstanceInfo;
}
