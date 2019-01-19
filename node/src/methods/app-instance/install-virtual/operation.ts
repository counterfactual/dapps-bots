import { InstructionExecutor } from "@counterfactual/machine";
import { AppInstanceInfo, Node } from "@counterfactual/types";

import { Store } from "../../../store";
import { ERRORS } from "../../errors";
import { createAppInstanceFromAppInstanceInfo } from "../install/operation";

export async function installVirtual(
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
  const updatedStateChannel = stateChannel.installApp(
    createAppInstanceFromAppInstanceInfo(appInstanceInfo, stateChannel),
    appInstanceInfo.myDeposit,
    appInstanceInfo.peerDeposit
  );

  delete appInstanceInfo.initialState;

  await store.updateChannelWithAppInstanceInstallation(
    updatedStateChannel,
    createAppInstanceFromAppInstanceInfo(appInstanceInfo, stateChannel)
      .identityHash,
    appInstanceInfo
  );

  return appInstanceInfo;
}
