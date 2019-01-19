import { Node } from "@counterfactual/types";

import { RequestHandler } from "../../../request-handler";
import { InstallVirtualMessage, NODE_EVENTS } from "../../../types";

import { installVirtual } from "./operation";

export default async function installVirtualAppInstanceController(
  requestHandler: RequestHandler,
  params: Node.InstallVirtualParams
): Promise<Node.InstallVirtualResult> {
  // TODO: temp workaround to get client-side facing calls working
  // until we integrate the machine into this call
  const { appInstanceId } = params;
  const proposedAppInstanceInfo = await requestHandler.store.getProposedAppInstanceInfo(
    appInstanceId
  );

  const appInstanceInfo = await installVirtual(
    requestHandler.store,
    requestHandler.instructionExecutor,
    requestHandler.address,
    proposedAppInstanceInfo.respondingAddress,
    params
  );

  const installVirtualApprovalMsg: InstallVirtualMessage = {
    from: requestHandler.address,
    event: NODE_EVENTS.INSTALL_VIRTUAL,
    data: {
      params: {
        appInstanceId
      }
    }
  };

  await requestHandler.messagingService.send(
    proposedAppInstanceInfo.initiatingAddress,
    installVirtualApprovalMsg
  );

  return {
    appInstance: appInstanceInfo
  };
}
